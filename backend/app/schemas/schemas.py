from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID
from datetime import datetime, date


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
    
# ── Orders ────────────────────────────────────────
class OrderEstimateRequest(BaseModel):
    pickup_address: str
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    drop_address: str
    drop_lat: Optional[float] = None
    drop_lng: Optional[float] = None
    length_cm: float
    breadth_cm: float
    height_cm: float
    actual_weight_kg: float
    order_type: str   # B2B or B2C
    payment_type: str # Prepaid or COD


class OrderEstimateResponse(BaseModel):
    pickup_zone_id: UUID
    drop_zone_id: UUID
    pickup_lat: Optional[float]
    pickup_lng: Optional[float]
    drop_lat: Optional[float]
    drop_lng: Optional[float]
    volumetric_weight_kg: float
    billed_weight_kg: float
    base_charge: float
    distance_km: float = 0
    distance_charge: float = 0
    cod_surcharge: float
    total_charge: float
    


from datetime import date

# ── Order Create / Response ───────────────────────
class OrderCreateRequest(BaseModel):
    pickup_address: str
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    drop_address: str
    drop_lat: Optional[float] = None
    drop_lng: Optional[float] = None
    length_cm: float
    breadth_cm: float
    height_cm: float
    actual_weight_kg: float
    order_type: str    # B2B or B2C
    payment_type: str  # Prepaid or COD


class TrackingEventOut(BaseModel):
    id: UUID
    status: str
    actor_role: str
    note: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class OrderOut(BaseModel):
    id: UUID
    customer_id: UUID
    agent_id: Optional[UUID]
    pickup_address: str
    drop_address: str
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    drop_lat: Optional[float] = None
    drop_lng: Optional[float] = None
    pickup_zone_id: Optional[UUID]
    drop_zone_id: Optional[UUID]
    order_type: str
    payment_type: str
    actual_weight_kg: Optional[float]
    volumetric_weight_kg: Optional[float]
    billed_weight_kg: Optional[float]
    base_charge: Optional[float]
    cod_surcharge: Optional[float]
    total_charge: Optional[float]
    status: str
    scheduled_date: Optional[date]
    created_at: Optional[datetime]
    tracking_events: list[TrackingEventOut] = []
    distance_km: Optional[float] = 0
    distance_charge: Optional[float] = 0

    class Config:
        from_attributes = True


class StatusUpdateRequest(BaseModel):
    status: str
    note: Optional[str] = None


class RescheduleRequest(BaseModel):
    scheduled_date: date


# ── Agent ─────────────────────────────────────────
class AgentLocationUpdate(BaseModel):
    current_lat: float
    current_lng: float
    is_available: Optional[bool] = None


class AgentProfileOut(BaseModel):
    user_id: UUID
    current_lat: Optional[float]
    current_lng: Optional[float]
    is_available: bool
    vehicle_type: Optional[str]=None
    total_deliveries: Optional[int]=0
    successful_deliveries: Optional[int]=0

    class Config:
        from_attributes = True


class AssignmentResult(BaseModel):
    order_id: UUID
    assigned_agent_id: UUID
    agent_name: str
    distance_km: float
    active_orders: int
    success_rate: float
    composite_score: float