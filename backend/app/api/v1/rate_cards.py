from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import require_admin, get_current_user
from app.models.models import RateCard
from app.schemas.schemas import RateCardCreate, RateCardUpdate, RateCardOut

router = APIRouter()


@router.post("/", response_model=RateCardOut, status_code=201)
async def create_rate_card(
    payload: RateCardCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    if payload.order_type not in ("B2B", "B2C"):
        raise HTTPException(status_code=400, detail="order_type must be B2B or B2C")

    # Check for duplicate
    existing = await db.execute(
        select(RateCard).where(
            RateCard.origin_zone_id == str(payload.origin_zone_id),
            RateCard.dest_zone_id == str(payload.dest_zone_id),
            RateCard.order_type == payload.order_type,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Rate card already exists for this zone pair and order type")

    card = RateCard(**payload.model_dump())
    db.add(card)
    await db.commit()
    await db.refresh(card)
    return card


@router.get("/", response_model=list[RateCardOut])
async def list_rate_cards(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(RateCard))
    return result.scalars().all()


@router.patch("/{card_id}", response_model=RateCardOut)
async def update_rate_card(
    card_id: str,
    payload: RateCardUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    result = await db.execute(select(RateCard).where(RateCard.id == card_id))
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Rate card not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(card, field, value)

    await db.commit()
    await db.refresh(card)
    return card