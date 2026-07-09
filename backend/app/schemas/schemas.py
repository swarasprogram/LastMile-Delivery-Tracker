from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID
from datetime import datetime


# ── Auth ──────────────────────────────────────────
class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str
    role: str = "customer"  # customer | agent | admin


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: str
    name: str


# ── User ──────────────────────────────────────────
class UserOut(BaseModel):
    id: UUID
    name: str
    email: str
    phone: Optional[str]
    role: str
    created_at: Optional[datetime]

    class Config:
        from_attributes = True