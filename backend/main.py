from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse, Response
from .database import users_collection, history_collection, client
from .models import User, LoginData
from ultralytics import YOLO
import base64, datetime, cv2, numpy as np
import jwt
from datetime import timedelta
from typing import Optional
from dotenv import load_dotenv
import os
import requests
from io import BytesIO
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------
# Load Environment Variables
# ---------------------------------------------------------
load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

if not SECRET_KEY:
    raise Exception("❌ SECRET_KEY missing in .env file!")

# ---------------------------------------------------------
# Create JWT Token
# ---------------------------------------------------------
def create_token(data: dict):
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + timedelta(hours=24)
    to_encode.update({"exp": expire})

    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return token


# ---------------------------------------------------------
# Extract Current User (Optional for IP Webcam endpoints)
# ---------------------------------------------------------
def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid Authorization header")

    token = authorization.split(" ", 1)[1]

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        if "email" not in payload:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        return payload

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# Optional auth for debugging
def get_current_user_optional(authorization: Optional[str] = Header(None)):
    if not authorization:
        return None
    try:
        return get_current_user(authorization)
    except:
        return None


# ---------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True
)


# ---------------------------------------------------------
# Startup: Load YOLO + DB test
# ---------------------------------------------------------
@app.on_event("startup")
async def startup_event():
    global model
    model = YOLO("backend/best.pt")
    logger.info("✅ YOLO model loaded!")


@app.on_event("shutdown")
async def shutdown_event():
    client.close()


@app.get("/")
def root():
    return {"status": "online", "message": "Backend is running"}


# ---------------------------------------------------------
# Register
# ---------------------------------------------------------
@app.post("/register")
def register(user: User):
    if users_collection.find_one({"email": user.email}):
        raise HTTPException(status_code=400, detail="User already exists")

    user_data = user.model_dump()
    # Set default role to 'user' if not specified
    if "role" not in user_data:
        user_data["role"] = "user"
    
    users_collection.insert_one(user_data)

    return {"message": "User created successfully"}


# ---------------------------------------------------------
# Login (with proper role verification)
# ---------------------------------------------------------
@app.post("/login")
def login(data: LoginData):
    user = users_collection.find_one({"email": data.email})

    if not user or user["password"] != data.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Get the actual role from database
    actual_role = user.get("role", "user")
    
    # If trying to login as admin, verify user actually has admin role
    if hasattr(data, 'role') and data.role == "admin":
        if actual_role != "admin":
            raise HTTPException(status_code=403, detail="Access denied. You don't have admin privileges.")
    
    token = create_token({
        "email": user["email"],
        "role": actual_role
    })

    return {"token": token, "role": actual_role}


# ---------------------------------------------------------
# SETUP: Create Admin (Use once, then remove or secure)
# ---------------------------------------------------------
@app.post("/setup/create-admin")
def create_admin(email: str, password: str, username: str = "Admin"):
    """
    Creates an admin user. Use this once to set up your first admin.
    SECURITY: Remove this endpoint or add authentication after setup!
    """
    # Check if user already exists
    existing_user = users_collection.find_one({"email": email})
    
    if existing_user:
        # Update existing user to admin
        users_collection.update_one(
            {"email": email},
            {"$set": {"role": "admin"}}
        )
        return {"message": f"User {email} has been upgraded to admin"}
    else:
        # Create new admin user
        users_collection.insert_one({
            "username": username,
            "email": email,
            "password": password,
            "role": "admin"
        })
        return {"message": f"Admin user created successfully: {email}"}


# ---------------------------------------------------------
# Detection Logic with Bounding Boxes
# ---------------------------------------------------------
def detect_image(image_bytes):
    img_array = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

    if img is None:
        raise ValueError("Failed to decode image")

    result = model(img)[0]

    labels = []
    
    # Draw bounding boxes on the image
    for box in result.boxes:
        cls = int(box.cls[0])
        label = model.names[cls]
        conf = float(box.conf[0])
        labels.append(label)
        
        # Get bounding box coordinates
        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
        x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
        
        # Draw rectangle
        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)
        
        # Prepare label text with confidence
        label_text = f"{label}: {conf:.2f}"
        
        # Calculate text size for background
        (text_width, text_height), baseline = cv2.getTextSize(
            label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2
        )
        
        # Draw filled rectangle as background for text
        cv2.rectangle(
            img, 
            (x1, y1 - text_height - 10), 
            (x1 + text_width, y1), 
            (0, 255, 0), 
            -1
        )
        
        # Put label text
        cv2.putText(
            img, 
            label_text, 
            (x1, y1 - 5), 
            cv2.FONT_HERSHEY_SIMPLEX, 
            0.5, 
            (0, 0, 0), 
            2
        )

    # Encode image to base64
    _, buffer = cv2.imencode(".jpg", img)
    b64_image = base64.b64encode(buffer).decode()

    return b64_image, labels


# ---------------------------------------------------------
# Test IP Webcam connection with detailed diagnostics
# ---------------------------------------------------------
@app.get("/ipwebcam/test")
async def test_ipwebcam(ip: str):
    """
    Tests if IP Webcam is accessible with multiple endpoints
    """
    logger.info(f"Testing connection to IP Webcam at {ip}")
    
    test_results = {
        "ip": ip,
        "tests": []
    }
    
    # Test 1: Basic connectivity (shot.jpg)
    try:
        url = f"http://{ip}:8080/shot.jpg"
        logger.info(f"Testing: {url}")
        response = requests.get(url, timeout=5)
        
        test_results["tests"].append({
            "endpoint": "/shot.jpg",
            "url": url,
            "status": response.status_code,
            "success": response.status_code == 200,
            "size": len(response.content) if response.status_code == 200 else 0
        })
    except requests.exceptions.Timeout:
        test_results["tests"].append({
            "endpoint": "/shot.jpg",
            "url": f"http://{ip}:8080/shot.jpg",
            "error": "Connection timeout - IP Webcam not responding"
        })
    except requests.exceptions.ConnectionError:
        test_results["tests"].append({
            "endpoint": "/shot.jpg",
            "url": f"http://{ip}:8080/shot.jpg",
            "error": "Connection refused - Check if IP Webcam is running"
        })
    except Exception as e:
        test_results["tests"].append({
            "endpoint": "/shot.jpg",
            "url": f"http://{ip}:8080/shot.jpg",
            "error": str(e)
        })
    
    # Test 2: Alternative endpoint (photo.jpg)
    try:
        url = f"http://{ip}:8080/photo.jpg"
        logger.info(f"Testing: {url}")
        response = requests.get(url, timeout=5)
        
        test_results["tests"].append({
            "endpoint": "/photo.jpg",
            "url": url,
            "status": response.status_code,
            "success": response.status_code == 200,
            "size": len(response.content) if response.status_code == 200 else 0
        })
    except Exception as e:
        test_results["tests"].append({
            "endpoint": "/photo.jpg",
            "url": f"http://{ip}:8080/photo.jpg",
            "error": str(e)
        })
    
    # Determine overall status
    any_success = any(test.get("success") for test in test_results["tests"])
    
    if any_success:
        test_results["status"] = "success"
        test_results["message"] = "IP Webcam is accessible! ✅"
    else:
        test_results["status"] = "error"
        errors = [test.get("error", "Unknown error") for test in test_results["tests"] if "error" in test]
        test_results["message"] = f"Cannot connect to IP Webcam: {errors[0] if errors else 'All tests failed'}"
    
    logger.info(f"Test results: {test_results}")
    return test_results


# ---------------------------------------------------------
# Get frame from IP Webcam (proxy)
# ---------------------------------------------------------
@app.get("/ipwebcam/frame")
async def get_ipwebcam_frame(ip: str):
    """
    Fetches a frame from IP Webcam - tries multiple endpoints
    """
    endpoints = ["/shot.jpg", "/photo.jpg"]
    
    for endpoint in endpoints:
        try:
            url = f"http://{ip}:8080{endpoint}"
            logger.info(f"Fetching frame from: {url}")
            
            response = requests.get(url, timeout=5)
            
            if response.status_code == 200:
                logger.info(f"✅ Successfully fetched frame from {endpoint}")
                return Response(
                    content=response.content,
                    media_type="image/jpeg",
                    headers={
                        "Cache-Control": "no-cache, no-store, must-revalidate",
                        "Pragma": "no-cache",
                        "Expires": "0"
                    }
                )
        except Exception as e:
            logger.warning(f"Failed to fetch from {endpoint}: {str(e)}")
            continue
    
    raise HTTPException(
        status_code=502, 
        detail=f"Failed to fetch frame from IP Webcam at {ip}:8080. Tried endpoints: {endpoints}"
    )


# ---------------------------------------------------------
# Upload Image + Save History (with optional history saving)
# ---------------------------------------------------------
@app.post("/upload")
async def upload(
    file: UploadFile = File(...), 
    save_history: bool = True,
    user: dict = Depends(get_current_user_optional)
):
    try:
        image_bytes = await file.read()
        processed_image, labels = detect_image(image_bytes)

        # Only save to history if user is authenticated and save_history is True
        if user and save_history:
            history_entry = {
                "email": user["email"],
                "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "labels": labels,
                "image": processed_image,
                "filename": file.filename
            }
            history_collection.insert_one(history_entry)

        return {
            "image": processed_image,
            "labels": labels,
            "message": "Detection complete"
        }
    except Exception as e:
        logger.error(f"Detection error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(e)}")


# ---------------------------------------------------------
# Fetch User History
# ---------------------------------------------------------
@app.get("/history")
def get_history(user: dict = Depends(get_current_user)):
    history = list(history_collection.find(
        {"email": user["email"]},
        {"_id": 0}
    ).sort("timestamp", -1))

    return history


# ---------------------------------------------------------
# User: Get Own Statistics
# ---------------------------------------------------------
@app.get("/user/stats")
def get_user_stats(user: dict = Depends(get_current_user)):
    # Get user's detection history
    user_history = list(history_collection.find(
        {"email": user["email"]},
        {"_id": 0}
    ))
    
    total_detections = len(user_history)
    
    # Count detections per label
    label_count = {}
    for item in user_history:
        for label in item.get("labels", []):
            label_count[label] = label_count.get(label, 0) + 1
    
    # Get detections over time (grouped by date)
    detections_by_date = {}
    for item in user_history:
        timestamp = item.get("timestamp", "")
        date = timestamp.split(" ")[0] if timestamp else "Unknown"
        detections_by_date[date] = detections_by_date.get(date, 0) + 1
    
    return {
        "total_detections": total_detections,
        "label_count": label_count,
        "detections_by_date": detections_by_date,
        "email": user["email"]
    }


# ---------------------------------------------------------
# Admin: Get All Users Stats
# ---------------------------------------------------------
@app.get("/admin/stats")
def get_admin_stats(user: dict = Depends(get_current_user)):
    # Check if user is admin
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get all detection history
    all_history = list(history_collection.find({}, {"_id": 0}))
    
    # Calculate overall statistics
    total_detections = len(all_history)
    
    # Count detections per label
    label_count = {}
    for item in all_history:
        for label in item.get("labels", []):
            label_count[label] = label_count.get(label, 0) + 1
    
    # Count detections per user
    user_detections = {}
    for item in all_history:
        email = item.get("email", "Unknown")
        user_detections[email] = user_detections.get(email, 0) + 1
    
    # Get unique users count
    unique_users = len(user_detections)
    
    # Get detections over time (grouped by date)
    detections_by_date = {}
    for item in all_history:
        timestamp = item.get("timestamp", "")
        date = timestamp.split(" ")[0] if timestamp else "Unknown"
        detections_by_date[date] = detections_by_date.get(date, 0) + 1
    
    return {
        "total_detections": total_detections,
        "unique_users": unique_users,
        "label_count": label_count,
        "user_detections": user_detections,
        "detections_by_date": detections_by_date
    }


# ---------------------------------------------------------
# Admin: Get All Users List
# ---------------------------------------------------------
@app.get("/admin/users")
def get_all_users(user: dict = Depends(get_current_user)):
    # Check if user is admin
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get all users (excluding passwords)
    users = list(users_collection.find({}, {"_id": 0, "password": 0}))
    
    # Add detection count for each user
    for u in users:
        detection_count = history_collection.count_documents({"email": u["email"]})
        u["detection_count"] = detection_count
    
    return users


# ---------------------------------------------------------
# Admin: Get Specific User's History
# ---------------------------------------------------------
@app.get("/admin/user/{email}/history")
def get_user_history_admin(email: str, user: dict = Depends(get_current_user)):
    # Check if user is admin
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    history = list(history_collection.find(
        {"email": email},
        {"_id": 0}
    ).sort("timestamp", -1))
    
    return history


# ---------------------------------------------------------
# Clear History
# ---------------------------------------------------------
@app.delete("/clear_history")
def clear_history(user: dict = Depends(get_current_user)):
    result = history_collection.delete_many({"email": user["email"]})

    return {"message": "History cleared", "deleted": result.deleted_count}


# ---------------------------------------------------------
# Run (local)
# ---------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)