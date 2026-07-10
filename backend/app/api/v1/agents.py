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
        # Create profile on first location ping
        profile = AgentProfile(user_id=current_user.id)
        db.add(profile)

    profile.current_lat = payload.current_lat
    profile.current_lng = payload.current_lng
    if payload.is_available is not None:
        profile.is_available = payload.is_available

    await db.commit()
    await db.refresh(profile)
    return profile


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