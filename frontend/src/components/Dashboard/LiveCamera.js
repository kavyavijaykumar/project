import React, { useRef, useState, useEffect } from "react";
import { api } from "../../api";
import "./LiveCamera.css";

function LiveCamera() {
  const canvasRef = useRef(null);
  const [active, setActive] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectedLabels, setDetectedLabels] = useState([]);
  const [fps, setFps] = useState(0);
  const [ipAddress, setIpAddress] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("");
  const [diagnostics, setDiagnostics] = useState(null);
  const intervalRef = useRef(null);
  const fpsCounterRef = useRef({ frames: 0, lastTime: Date.now() });
  const [isLoading, setIsLoading] = useState(false);
  const [errorCount, setErrorCount] = useState(0);

  // Test IP Webcam connection with diagnostics
  const testConnection = async () => {
    if (!ipAddress.trim()) {
      alert("⚠️ Please enter your IP Webcam address!");
      return;
    }

    try {
      setConnectionStatus("Testing connection...");
      setIsLoading(true);
      setDiagnostics(null);

      console.log("🔍 Testing connection to:", ipAddress.trim());

      const response = await api.get(`/ipwebcam/test?ip=${ipAddress.trim()}`);
      
      console.log("📊 Test results:", response.data);
      setDiagnostics(response.data);
      
      if (response.data.status === "success") {
        setConnectionStatus("Connected ✅");
        return true;
      } else {
        setConnectionStatus(`Connection failed ❌`);
        
        // Show detailed error info
        const errorDetails = response.data.tests
          .filter(t => t.error)
          .map(t => `${t.endpoint}: ${t.error}`)
          .join('\n');
        
        alert(
          "❌ Unable to connect to IP Webcam!\n\n" +
          "Diagnostic Results:\n" +
          errorDetails + "\n\n" +
          "Troubleshooting Steps:\n" +
          "1. Make sure IP Webcam app is running on your phone\n" +
          "2. Check IP address is correct: " + ipAddress + "\n" +
          "3. Both devices must be on the SAME WiFi network\n" +
          "4. Try opening in phone browser: http://" + ipAddress + ":8080\n" +
          "5. Disable any VPN or firewall on your phone\n" +
          "6. Try restarting the IP Webcam app"
        );
        return false;
      }
    } catch (err) {
      console.error("❌ Connection test error:", err);
      setConnectionStatus("Test failed ❌");
      
      let errorMsg = "Unknown error";
      if (err.response) {
        errorMsg = err.response.data?.detail || err.response.statusText;
      } else if (err.request) {
        errorMsg = "Cannot reach backend server - is it running?";
      } else {
        errorMsg = err.message;
      }
      
      alert(
        "❌ Connection test failed!\n\n" +
        "Error: " + errorMsg + "\n\n" +
        "Please check:\n" +
        "1. Backend server is running on port 8000\n" +
        "2. IP Webcam app is running on phone\n" +
        "3. Phone and laptop are on same WiFi\n" +
        "4. IP address format: 192.168.x.x (no http:// or :8080)"
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Start IP Webcam
  const startCamera = async () => {
    const connected = await testConnection();
    if (connected) {
      setActive(true);
      setErrorCount(0);
      console.log("✅ Camera connected, ready to start detection");
    }
  };

  // Stop camera
  const stopCamera = () => {
    setActive(false);
    setConnectionStatus("");
    setDiagnostics(null);
    stopDetection();
    console.log("🛑 Camera stopped");
  };

  // Start detection
  const startDetection = () => {
    if (!active && !ipAddress.trim()) {
      alert("⚠️ Camera not started yet!");
      return;
    }
    
    setDetecting(true);
    setErrorCount(0);
    console.log("▶️ Starting detection loop...");
    
    // Start detection loop
    intervalRef.current = setInterval(() => {
      fetchAndDetectFrame();
    }, 1000); // Fetch frame every 1 second
  };

  // Stop detection
  const stopDetection = () => {
    setDetecting(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setDetectedLabels([]);
    setFps(0);
    setErrorCount(0);
    
    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    console.log("⏸️ Detection stopped");
  };

  // Fetch frame from IP Webcam via backend and detect
  const fetchAndDetectFrame = async () => {
    if (!canvasRef.current || !ipAddress.trim()) return;

    try {
      console.log("📸 Fetching frame from IP:", ipAddress.trim());

      // Step 1: Fetch frame through backend proxy
      const frameUrl = `/ipwebcam/frame?ip=${ipAddress.trim()}`;
      const frameResponse = await api.get(frameUrl, {
        responseType: 'blob',
        timeout: 10000 // 10 second timeout
      });

      console.log("✅ Frame fetched, size:", frameResponse.data.size, "bytes");

      // Reset error count on successful fetch
      setErrorCount(0);

      // Step 2: Convert blob to file for upload
      const file = new File([frameResponse.data], "frame.jpg", { type: "image/jpeg" });
      
      // Step 3: Send to detection endpoint
      const formData = new FormData();
      formData.append("file", file);

      console.log("🔍 Sending frame for detection...");

      const response = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        params: { save_history: false },
        timeout: 15000 // 15 second timeout
      });

      console.log("✅ Detection complete, labels:", response.data.labels);

      // Update detected labels
      if (response.data.labels && response.data.labels.length > 0) {
        setDetectedLabels(response.data.labels);
      } else {
        setDetectedLabels([]);
      }

      // Draw detection results on canvas
      if (response.data.image && canvasRef.current) {
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        
        const img = new Image();
        img.onload = () => {
          // Set canvas size to match image
          canvas.width = img.width;
          canvas.height = img.height;
          
          // Draw the image with bounding boxes
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Update FPS counter
          updateFPS();
        };
        img.onerror = (e) => {
          console.error("❌ Failed to load detection image", e);
        };
        img.src = `data:image/jpeg;base64,${response.data.image}`;
      }

    } catch (error) {
      console.error("❌ Frame fetch/detection error:", error);
      
      setErrorCount(prev => prev + 1);

      // Show specific error messages
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        console.warn("⏱️ Request timeout - this is normal occasionally");
      } else if (error.response?.status === 502) {
        console.error("🔌 Lost connection to IP Webcam");
        setConnectionStatus("Connection lost ⚠️");
      } else if (error.response?.status === 401) {
        console.error("🔐 Authentication error");
        alert("Session expired. Please login again.");
        stopDetection();
        return;
      }

      // Stop detection after multiple consecutive errors
      if (errorCount >= 5) {
        console.error("❌ Too many errors, stopping detection");
        alert("Lost connection to IP Webcam. Please check your connection and try again.");
        stopDetection();
      }
    }
  };

  // Update FPS counter
  const updateFPS = () => {
    fpsCounterRef.current.frames++;
    const now = Date.now();
    const elapsed = now - fpsCounterRef.current.lastTime;

    if (elapsed >= 1000) {
      setFps(fpsCounterRef.current.frames);
      fpsCounterRef.current.frames = 0;
      fpsCounterRef.current.lastTime = now;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="live-camera-container">
      <h2>🎥 Live Camera Detection (IP Webcam)</h2>

      {/* IP Address Input */}
      {!active && (
        <div className="ip-webcam-setup">
        
          <div className="ip-input-section">
            <label htmlFor="ip-input">📡 Enter IP Webcam Address:</label>
            <input
              id="ip-input"
              type="text"
              className="ip-input"
              placeholder="Example: 192.168.1.100"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !isLoading) {
                  startCamera();
                }
              }}
              disabled={isLoading}
            />
        
          </div>
        </div>
      )}

      {/* Connection Status */}
      {connectionStatus && (
        <div className={`connection-status ${
          connectionStatus.includes('✅') ? 'success' : 
          connectionStatus.includes('❌') ? 'error' : 
          'warning'
        }`}>
          <p>{connectionStatus}</p>
        </div>
      )}

      {/* Diagnostics Display */}
      {diagnostics && (
        <div className="diagnostics-panel">
          <h4>🔧 Connection Diagnostics:</h4>
          <div className="diagnostics-content">
            <p><strong>IP Address:</strong> {diagnostics.ip}:8080</p>
            {diagnostics.tests && diagnostics.tests.map((test, idx) => (
              <div key={idx} className={`diagnostic-item ${test.success ? 'success' : 'error'}`}>
                <strong>{test.endpoint}:</strong> {
                  test.success 
                    ? `✅ Success (${test.size} bytes)` 
                    : `❌ ${test.error || 'Failed'}`
                }
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Camera Display */}
      <div className="camera-display">
        {active ? (
          <div className="video-container">
            {/* Canvas to display detection results */}
            <canvas
              ref={canvasRef}
              className="detection-canvas"
            />
            {!detecting && (
              <div className="canvas-overlay">
                <p>✅ Connected! Click "Start Detection" to begin</p>
              </div>
            )}
            {detecting && errorCount > 0 && (
              <div className="error-indicator">
                ⚠️ Connection issues ({errorCount} errors)
              </div>
            )}
          </div>
        ) : (
          <div className="camera-placeholder">
            <div className="placeholder-icon">📹</div>
            <p>Enter IP address above and click "Start Camera"</p>
            <small>Make sure IP Webcam app is running on your phone</small>
          </div>
        )}
      </div>

      {/* Detection Stats */}
      {active && (
        <div className="detection-stats">
          <div className="stat-item">
            <span className="stat-label">Status:</span>
            <span className={`stat-value ${detecting ? "active" : ""}`}>
              {detecting ? "🟢 Detecting" : "🔴 Paused"}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">FPS:</span>
            <span className="stat-value">{fps}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Objects Found:</span>
            <span className="stat-value">{detectedLabels.length}</span>
          </div>
        </div>
      )}

      {/* Detected Objects */}
      {detectedLabels.length > 0 && (
        <div className="detected-objects">
          <h3>🎯 Detected Objects:</h3>
          <div className="labels-container">
            {[...new Set(detectedLabels)].map((label, index) => (
              <span key={index} className="label-badge">
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="controls">
        {!active ? (
          <button 
            className="btn btn-primary" 
            onClick={startCamera}
            disabled={isLoading}
          >
            {isLoading ? "⏳ Testing Connection..." : "📹 Start Camera"}
          </button>
        ) : (
          <>
            {!detecting ? (
              <button className="btn btn-success" onClick={startDetection}>
                ▶️ Start Detection
              </button>
            ) : (
              <button className="btn btn-warning" onClick={stopDetection}>
                ⏸️ Pause Detection
              </button>
            )}
            <button className="btn btn-danger" onClick={stopCamera}>
              ⏹️ Stop Camera
            </button>
          </>
        )}
      </div>

    </div>
  );
}

export default LiveCamera;