import math
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import RateCard

RATE_PER_KM = 3.0        # ₹3 per km
COD_SURCHARGE_RATE = 0.02  # 2% of base charge


def calculate_volumetric_weight(length_cm: float, breadth_cm: float, height_cm: float) -> float:
    return (length_cm * breadth_cm * height_cm) / 5000


def calculate_billed_weight(actual_kg: float, volumetric_kg: float) -> float:
    return max(actual_kg, volumetric_kg)


def haversine_km(lat1, lng1, lat2, lng2) -> float:
    R = 6371
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def get_rate_card(origin_zone_id, dest_zone_id, order_type: str, db: AsyncSession):
    # Exact match
    result = await db.execute(
        select(RateCard).where(
            RateCard.origin_zone_id == origin_zone_id,
            RateCard.dest_zone_id == dest_zone_id,
            RateCard.order_type == order_type,
        )
    )
    card = result.scalar_one_or_none()
    if card:
        return card

    # Same order type, any zone
    result = await db.execute(
        select(RateCard).where(RateCard.order_type == order_type).limit(1)
    )
    card = result.scalar_one_or_none()
    if card:
        return card

    # Any card
    result = await db.execute(select(RateCard).limit(1))
    card = result.scalar_one_or_none()
    if card:
        return card

    raise ValueError("No rate card found. Please add one via /api/v1/rate-cards/")


async def calculate_charge(
    origin_zone_id,
    dest_zone_id,
    order_type: str,
    actual_weight_kg: float,
    length_cm: float,
    breadth_cm: float,
    height_cm: float,
    payment_type: str,
    db: AsyncSession,
    pickup_lat: float = None,
    pickup_lng: float = None,
    drop_lat: float = None,
    drop_lng: float = None,
) -> dict:
    rate_card = await get_rate_card(origin_zone_id, dest_zone_id, order_type, db)

    volumetric = calculate_volumetric_weight(length_cm, breadth_cm, height_cm)
    billed = calculate_billed_weight(actual_weight_kg, volumetric)
    base_charge = round(float(rate_card.rate_per_kg) * billed, 2)

    # Distance surcharge
    distance_km = 0.0
    distance_charge = 0.0
    if pickup_lat and pickup_lng and drop_lat and drop_lng:
        distance_km = haversine_km(pickup_lat, pickup_lng, drop_lat, drop_lng)
        distance_charge = round(distance_km * RATE_PER_KM, 2)

    # COD surcharge
    cod_surcharge = round((base_charge + distance_charge) * COD_SURCHARGE_RATE, 2) if payment_type == "COD" else 0.0

    total_charge = round(base_charge + distance_charge + cod_surcharge, 2)

    return {
        "volumetric_weight_kg": round(volumetric, 3),
        "billed_weight_kg": round(billed, 3),
        "base_charge": base_charge,
        "distance_km": round(distance_km, 2),
        "distance_charge": distance_charge,
        "cod_surcharge": cod_surcharge,
        "total_charge": total_charge,
    }