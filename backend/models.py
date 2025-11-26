from pydantic import BaseModel
from typing import Optional

class User(BaseModel):
    username: str
    email: str
    password: str
    role: Optional[str] = "user"  # Default role is 'user'

class LoginData(BaseModel):
    email: str
    password: str
    role: Optional[str] = None  # Role is optional, used to check admin access