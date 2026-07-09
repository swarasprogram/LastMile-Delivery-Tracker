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


# ── Zone ──────────────────────────────────────────
class ZoneCreate(BaseModel):
    name: str
    boundary: Optional[dict] = None  # GeoJSON polygon


class ZoneOut(BaseModel):
    id: UUID
    name: str
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── Area ──────────────────────────────────────────
class AreaCreate(BaseModel):
    name: str
    lat: Optional[float] = None
    lng: Optional[float] = None


class AreaOut(BaseModel):
    id: UUID
    zone_id: UUID
    name: str

    class Config:
        from_attributes = True


# ── Rate Card ─────────────────────────────────────
class RateCardCreate(BaseModel):
    origin_zone_id: UUID
    dest_zone_id: UUID
    order_type: str        # B2B or B2C
    base_rate: float       # per kg
    min_charge: float
    cod_surcharge: float = 0.0


class RateCardUpdate(BaseModel):
    base_rate: Optional[float] = None
    min_charge: Optional[float] = None
    cod_surcharge: Optional[float] = None
    is_active: Optional[bool] = None


class RateCardOut(BaseModel):
    id: UUID
    origin_zone_id: UUID
    dest_zone_id: UUID
    order_type: str
    base_rate: float
    min_charge: float
    cod_surcharge: float
    is_active: bool

    class Config:
        from_attributes = True