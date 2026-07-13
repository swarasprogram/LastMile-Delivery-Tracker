from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from uuid import UUID

from app.core.database import get_db
from app.core.config import settings
from app.core.deps import get_current_user
from app.models.models import User, Order
from app.services import payment_service
from app.services.payment_service import PaymentConfigError

router = APIRouter()


class CreateCheckoutRequest(BaseModel):
    order_id: UUID


class ConfirmRequest(BaseModel):
    order_id: UUID
    session_id: str


@router.get("/config")
async def payment_config(current_user: User = Depends(get_current_user)):
    """Expose the publishable key + whether Stripe is configured."""
    return {
        "configured": bool(settings.STRIPE_SECRET_KEY),
        "publishable_key": settings.STRIPE_PUBLISHABLE_KEY,
        "currency": settings.CURRENCY,
    }


async def _get_owned_order(order_id, current_user, db) -> Order:
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if current_user.role == "customer" and str(order.customer_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    return order


@router.post("/create-checkout")
async def create_checkout(
    payload: CreateCheckoutRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = await _get_owned_order(payload.order_id, current_user, db)

    if order.payment_type != "Prepaid":
        raise HTTPException(status_code=400, detail="Only prepaid orders require checkout")
    if order.payment_status == "paid":
        raise HTTPException(status_code=400, detail="Order is already paid")

    try:
        session = payment_service.create_checkout_session(order)
    except PaymentConfigError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Stripe error: {e}")

    return {"checkout_url": session["url"], "session_id": session["id"]}


@router.post("/confirm")
async def confirm_payment(
    payload: ConfirmRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = await _get_owned_order(payload.order_id, current_user, db)

    try:
        paid, payment_intent = payment_service.confirm_session(payload.session_id)
    except PaymentConfigError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Stripe error: {e}")

    if not paid:
        return {"status": "pending", "payment_status": order.payment_status}

    order.payment_status = "paid"
    order.payment_ref = payment_intent
    await db.commit()
    return {"status": "verified", "payment_status": "paid"}
