import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

client = MongoClient(os.getenv("MONGO_URL"))
db = client["camousense_db"]
users_collection = db["users"]
history_collection = db["history"]
