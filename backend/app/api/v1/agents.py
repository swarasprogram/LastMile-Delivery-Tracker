from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models.models import User, AgentProfile, Order
from app.schemas.schemas import AgentLocationUpdate, AgentProfileOut, AssignmentResult
from app.services.auto_assign import find_best_agent

router = APIRouter()


# ── Admin: list all agents ────────────────────────────────────────────────────

@router.get("/", response_model=list)
async def list_agents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Return all users with role=agent plus their profile (location, availability)."""
    result = await db.execute(
        select(User).where(User.role == "agent")
    )
    users = result.scalars().all()

    # Load profiles in one shot
    agent_ids = [u.id for u in users]
    profiles_result = await db.execute(
        select(AgentProfile).where(AgentProfile.user_id.in_(agent_ids))
    )
    profiles = {p.user_id: p for p in profiles_result.scalars().all()}

    # Load active order counts
    orders_result = await db.execute(
        select(Order).where(Order.agent_id.in_(agent_ids))
    )
    all_orders = orders_result.scalars().all()
    order_counts = {}
    for o in all_orders:
        order_counts.setdefault(o.agent_id, {"total": 0, "active": 0, "delivered": 0, "failed": 0})
        order_counts[o.agent_id]["total"] += 1
        if o.status in ("agent_assigned", "picked_up", "in_transit", "out_for_delivery"):
            order_counts[o.agent_id]["active"] += 1
        elif o.status == "delivered":
            order_counts[o.agent_id]["delivered"] += 1
        elif o.status == "failed":
            order_counts[o.agent_id]["failed"] += 1

    output = []
    for u in users:
        p = profiles.get(u.id)
        counts = order_counts.get(u.id, {"total": 0, "active": 0, "delivered": 0, "failed": 0})
        success_rate = round(counts["delivered"] / counts["total"], 3) if counts["total"] > 0 else 0.0
        output.append({
            "id": str(u.id),
            "name": u.name,
            "email": u.email,
            "is_online": bool(p and p.current_lat),
            "current_lat": float(p.current_lat) if p and p.current_lat else None,
            "current_lng": float(p.current_lng) if p and p.current_lng else None,
            "is_available": p.is_available if p else True,
            "total_orders": counts["total"],
            "active_orders": counts["active"],
            "delivered_orders": counts["delivered"],
            "failed_orders": counts["failed"],
            "success_rate": success_rate,
        })

    return output


# ── Agent: update own location ────────────────────────────────────────────────

@router.patch("/location", response_model=AgentProfileOut)
async def update_location(
    payload: AgentLocationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "agent":
        raise HTTPException(status_code=403, detail="Only agents can update location")

    result = await db.execute(
        select(AgentProfile).where(AgentProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        profile = AgentProfile(user_id=current_user.id)
        db.add(profile)

    profile.current_lat = payload.current_lat
    profile.current_lng = payload.current_lng
    if payload.is_available is not None:
        profile.is_available = payload.is_available

    await db.commit()
    await db.refresh(profile)
    return profile


# ── Agent: get own orders ─────────────────────────────────────────────────────

@router.get("/my-orders", response_model=list)
async def my_orders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "agent":
        raise HTTPException(status_code=403, detail="Agents only")

    result = await db.execute(
        select(Order)
        .where(Order.agent_id == current_user.id)
        .options(selectinload(Order.tracking_events))
    )
    return result.scalars().all()
