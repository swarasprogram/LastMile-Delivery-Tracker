import hmac
import hashlib
import os
import razorpay
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from uuid import UUID

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import User, Order

router = APIRouter()

RAZORPAY_KEY_ID     = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")


def get_razorpay_client():
    return razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


class CreateOrderRequest(BaseModel):
    order_id: UUID


class VerifyRequest(BaseModel):
    order_id: UUID
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@router.post("/create-order")
async def create_payment_order(
    payload: CreateOrderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Order).where(Order.id == payload.order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if str(order.customer_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    # Amount in paise (Razorpay uses smallest currency unit)
    amount_paise = int(float(order.total_charge) * 100)

    rz = get_razorpay_client()
    rz_order = rz.order.create({
        "amount": amount_paise,
        "currency": "INR",
        "receipt": str(order.id),
        "payment_capture": 1,
    })

    return {
        "razorpay_order_id": rz_order["id"],
        "amount": amount_paise,
        "currency": "INR",
        "key": RAZORPAY_KEY_ID,
    }


@router.post("/verify")
async def verify_payment(
    payload: VerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify signature
    body = f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}"
    expected = hmac.new(
        RAZORPAY_KEY_SECRET.encode(),
        body.encode(),
        hashlib.sha256,
    ).hexdigest()

    if expected != payload.razorpay_signature:
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    # Mark order as paid
    result = await db.execute(select(Order).where(Order.id == payload.order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.payment_id = payload.razorpay_payment_id
    order.payment_status = "paid"
    await db.commit()

    return {"status": "verified", "payment_id": payload.razorpay_payment_id}
