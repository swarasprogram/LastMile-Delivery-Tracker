from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import RateCard


def calculate_volumetric_weight(length_cm: float, breadth_cm: float, height_cm: float) -> float:
    """Standard logistics formula: L × B × H ÷ 5000"""
    return (length_cm * breadth_cm * height_cm) / 5000


def calculate_billed_weight(actual_kg: float, volumetric_kg: float) -> float:
    """Bill on whichever is higher."""
    return max(actual_kg, volumetric_kg)


async def get_rate_card(
    origin_zone_id: str,
    dest_zone_id: str,
    order_type: str,
    db: AsyncSession
) -> RateCard | None:
    result = await db.execute(
        select(RateCard).where(
            RateCard.origin_zone_id == origin_zone_id,
            RateCard.dest_zone_id == dest_zone_id,
            RateCard.order_type == order_type,
            RateCard.is_active == True,
        )
    )
    return result.scalar_one_or_none()


async def calculate_charge(
    origin_zone_id: str,
    dest_zone_id: str,
    order_type: str,
    actual_weight_kg: float,
    length_cm: float,
    breadth_cm: float,
    height_cm: float,
    payment_type: str,
    db: AsyncSession,
) -> dict:
    """
    Full rate calculation. Returns a breakdown dict.
    Raises ValueError if no rate card found.
    """
    volumetric_weight = calculate_volumetric_weight(length_cm, breadth_cm, height_cm)
    billed_weight = calculate_billed_weight(actual_weight_kg, volumetric_weight)

    rate_card = await get_rate_card(origin_zone_id, dest_zone_id, order_type, db)
    if not rate_card:
        raise ValueError(f"No active rate card found for {order_type} orders from zone {origin_zone_id} to {dest_zone_id}")

    base_charge = max(
        float(billed_weight) * float(rate_card.base_rate),
        float(rate_card.min_charge)
    )

    cod_surcharge = float(rate_card.cod_surcharge) if payment_type == "COD" else 0.0
    total_charge = base_charge + cod_surcharge

    return {
        "volumetric_weight_kg": round(volumetric_weight, 3),
        "billed_weight_kg": round(billed_weight, 3),
        "actual_weight_kg": actual_weight_kg,
        "base_charge": round(base_charge, 2),
        "cod_surcharge": round(cod_surcharge, 2),
        "total_charge": round(total_charge, 2),
        "rate_card_id": str(rate_card.id),
        "origin_zone_id": origin_zone_id,
        "dest_zone_id": dest_zone_id,
    }