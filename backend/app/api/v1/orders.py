from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_role, require_admin
from app.models.models import User, Order, TrackingEvent
from app.services.zone_detector import resolve_zone
from app.services.rate_engine import calculate_charge
from app.schemas.schemas import (
    OrderEstimateRequest, OrderEstimateResponse,
    OrderCreateRequest, OrderOut,
    StatusUpdateRequest, RescheduleRequest,
    AssignmentResult,
)

router = APIRouter()

VALID_TRANSITIONS = {
    "confirmed":         ["agent_assigned"],
    "agent_assigned":    ["picked_up", "failed"],
    "picked_up":         ["in_transit", "failed"],
    "in_transit":        ["out_for_delivery", "failed"],
    "out_for_delivery":  ["delivered", "failed"],
    "failed":            ["rescheduled"],
    "rescheduled":       ["agent_assigned"],
}


async def _log_event(db, order_id, status, actor, note=None):
    event = TrackingEvent(
        order_id=order_id,
        status=status,
        actor_id=actor.id,
        actor_role=actor.role,
        note=note,
    )
    db.add(event)


@router.post("/estimate", response_model=OrderEstimateResponse)
async def estimate_order(
    payload: OrderEstimateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pickup_zone_id, pickup_lat, pickup_lng = await resolve_zone(
        payload.pickup_address, payload.pickup_lat, payload.pickup_lng, db
    )
    if not pickup_zone_id:
        raise HTTPException(status_code=400, detail="Could not detect zone for pickup address.")

    drop_zone_id, drop_lat, drop_lng = await resolve_zone(
        payload.drop_address, payload.drop_lat, payload.drop_lng, db
    )
    if not drop_zone_id:
        raise HTTPException(status_code=400, detail="Could not detect zone for drop address.")

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
            pickup_lat=pickup_lat,
            pickup_lng=pickup_lng,
            drop_lat=drop_lat,
            drop_lng=drop_lng,
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


@router.post("/", response_model=OrderOut, status_code=201)
async def create_order(
    payload: OrderCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Resolve zones
    pickup_zone_id, pickup_lat, pickup_lng = await resolve_zone(
        payload.pickup_address, payload.pickup_lat, payload.pickup_lng, db
    )
    if not pickup_zone_id:
        raise HTTPException(status_code=400, detail="Could not detect zone for pickup address.")

    drop_zone_id, drop_lat, drop_lng = await resolve_zone(
        payload.drop_address, payload.drop_lat, payload.drop_lng, db
    )
    if not drop_zone_id:
        raise HTTPException(status_code=400, detail="Could not detect zone for drop address.")

    # Calculate charge
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
            pickup_lat=pickup_lat,
            pickup_lng=pickup_lng,
            drop_lat=drop_lat,
            drop_lng=drop_lng,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Create order
    order = Order(
        customer_id=current_user.id,
        pickup_address=payload.pickup_address,
        pickup_lat=pickup_lat,
        pickup_lng=pickup_lng,
        pickup_zone_id=pickup_zone_id,
        drop_address=payload.drop_address,
        drop_lat=drop_lat,
        drop_lng=drop_lng,
        drop_zone_id=drop_zone_id,
        length_cm=payload.length_cm,
        breadth_cm=payload.breadth_cm,
        height_cm=payload.height_cm,
        actual_weight_kg=payload.actual_weight_kg,
        volumetric_weight_kg=charge["volumetric_weight_kg"],
        billed_weight_kg=charge["billed_weight_kg"],
        order_type=payload.order_type,
        payment_type=payload.payment_type,
        base_charge=charge["base_charge"],
        cod_surcharge=charge["cod_surcharge"],
        total_charge=charge["total_charge"],
        status="confirmed",
        confirmed_at=datetime.utcnow(),
    )
    db.add(order)
    await db.flush()

    # Log first tracking event
    await _log_event(db, order.id, "confirmed", current_user)

    await db.commit()

    # Reload with tracking events
    result = await db.execute(
        select(Order)
        .where(Order.id == order.id)
        .options(selectinload(Order.tracking_events))
        .execution_options(populate_existing=True)
    )
    return result.scalar_one()


@router.get("/", response_model=list[OrderOut])
async def list_orders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "admin":
        result = await db.execute(
            select(Order).options(selectinload(Order.tracking_events))
        )
    elif current_user.role == "customer":
        result = await db.execute(
            select(Order)
            .where(Order.customer_id == current_user.id)
            .options(selectinload(Order.tracking_events))
        )
    else:  # agent
        result = await db.execute(
            select(Order)
            .where(Order.agent_id == current_user.id)
            .options(selectinload(Order.tracking_events))
        )
    return result.scalars().all()


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.tracking_events))
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Customers can only see their own orders
    if current_user.role == "customer" and str(order.customer_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    return order


@router.patch("/{order_id}/status", response_model=OrderOut)
async def update_status(
    order_id: str,
    payload: StatusUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.tracking_events))
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Validate transition
    allowed = VALID_TRANSITIONS.get(order.status, [])
    if payload.status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from '{order.status}' to '{payload.status}'. Allowed: {allowed}"
        )

    order.status = payload.status
    await _log_event(db, order.id, payload.status, current_user, payload.note)

    # Send failure email to customer
    if payload.status == "failed":
        try:
            from app.services.email_service import send_failure_email
            customer_result = await db.execute(select(User).where(User.id == order.customer_id))
            customer = customer_result.scalar_one_or_none()
            if customer:
                import asyncio
                asyncio.create_task(send_failure_email(
                    customer_email=customer.email,
                    customer_name=customer.name,
                    order_id=str(order.id),
                    pickup=order.pickup_address,
                    drop=order.drop_address,
                    note=payload.note or "",
                ))
        except Exception:
            pass  # Never block status update for email failure

    await db.commit()

    result = await db.execute(
        select(Order)
        .where(Order.id == order.id)
        .options(selectinload(Order.tracking_events))
        .execution_options(populate_existing=True)
    )
    return result.scalar_one()


@router.post("/{order_id}/reschedule", response_model=OrderOut)
async def reschedule_order(
    order_id: str,
    payload: RescheduleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.tracking_events))
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status != "failed":
        raise HTTPException(status_code=400, detail="Only failed orders can be rescheduled")

    if current_user.role == "customer" and str(order.customer_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    order.status = "rescheduled"
    order.scheduled_date = payload.scheduled_date
    await _log_event(db, order.id, "rescheduled", current_user, f"Rescheduled for {payload.scheduled_date}")
    await db.commit()

    result = await db.execute(
        select(Order)
        .where(Order.id == order.id)
        .options(selectinload(Order.tracking_events))
        .execution_options(populate_existing=True)
    )
    return result.scalar_one()


@router.post("/{order_id}/assign", response_model=AssignmentResult)
async def auto_assign(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    from app.services.auto_assign import find_best_agent

    result = await db.execute(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.tracking_events))
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status != "confirmed":
        raise HTTPException(status_code=400, detail="Only confirmed orders can be auto-assigned")

    if not order.pickup_lat or not order.pickup_lng:
        raise HTTPException(status_code=400, detail="Order has no pickup coordinates for proximity scoring")

    best_agent, score, breakdown = await find_best_agent(order.pickup_lat, order.pickup_lng, db)

    if not best_agent:
        raise HTTPException(status_code=404, detail="No available agents with location data")

    order.agent_id = best_agent.id
    order.status = "agent_assigned"
    await _log_event(db, order.id, "agent_assigned", current_user, f"Auto-assigned to {best_agent.name}")
    await db.commit()

    return AssignmentResult(
        order_id=order.id,
        assigned_agent_id=best_agent.id,
        agent_name=best_agent.name,
        distance_km=breakdown["distance_km"],
        active_orders=breakdown["active_orders"],
        success_rate=breakdown["success_rate"],
        composite_score=breakdown["composite_score"],
    )


@router.get("/{order_id}/agent-location")
async def get_agent_location(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order or not order.agent_id:
        raise HTTPException(status_code=404, detail="No agent assigned")

    from app.models.models import AgentProfile
    profile_result = await db.execute(
        select(AgentProfile).where(AgentProfile.user_id == order.agent_id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile or not profile.current_lat:
        raise HTTPException(status_code=404, detail="Agent location unavailable")

    return {"lat": float(profile.current_lat), "lng": float(profile.current_lng)}
