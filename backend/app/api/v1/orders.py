from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import User
from app.services.zone_detector import resolve_zone
from app.services.rate_engine import calculate_charge
from app.schemas.schemas import OrderEstimateRequest, OrderEstimateResponse

router = APIRouter()


@router.post("/estimate", response_model=OrderEstimateResponse)
async def estimate_order(
    payload: OrderEstimateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Resolve pickup zone
    pickup_zone_id, pickup_lat, pickup_lng = await resolve_zone(
        payload.pickup_address, payload.pickup_lat, payload.pickup_lng, db
    )
    if not pickup_zone_id:
        raise HTTPException(status_code=400, detail="Could not detect zone for pickup address. Please map the area to a zone first.")

    # Resolve drop zone
    drop_zone_id, drop_lat, drop_lng = await resolve_zone(
        payload.drop_address, payload.drop_lat, payload.drop_lng, db
    )
    if not drop_zone_id:
        raise HTTPException(status_code=400, detail="Could not detect zone for drop address. Please map the area to a zone first.")

    try:
        charge = await calculate_charge(
            origin_zone_id=pickup_zone_id,
            dest_zone_id=drop_zone_id,
            order_type=payload.order_type,
            actual_weight_kg=payload.actual_weight_kg,
            length_cm=payload.length_cm,
            breadth_cm=payload.breadth_cm,
            height_cm=payload.height_cm,
            payment_type=payload.payment_type,
            db=db,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return OrderEstimateResponse(
        pickup_zone_id=pickup_zone_id,
        drop_zone_id=drop_zone_id,
        pickup_lat=pickup_lat,
        pickup_lng=pickup_lng,
        drop_lat=drop_lat,
        drop_lng=drop_lng,
        **charge,
    )