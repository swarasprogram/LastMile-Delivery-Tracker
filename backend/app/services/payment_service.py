"""
Stripe (test mode) payment helpers.

Prepaid orders are paid through a Stripe Checkout Session (hosted page, test
card 4242 4242 4242 4242). When a prepaid+paid order later fails delivery, the
charge is refunded through the Stripe Refund API.

All functions raise ``PaymentConfigError`` if Stripe keys are not configured so
the API can return a clear message instead of a 500.
"""

from app.core.config import settings


class PaymentConfigError(Exception):
    pass


def _client():
    """Import Stripe lazily so the API still boots if the package/keys are
    absent — only actual payment calls require it."""
    if not settings.STRIPE_SECRET_KEY:
        raise PaymentConfigError(
            "Stripe is not configured. Add STRIPE_SECRET_KEY and "
            "STRIPE_PUBLISHABLE_KEY to backend/.env (test keys from "
            "https://dashboard.stripe.com/test/apikeys)."
        )
    try:
        import stripe
    except ImportError:
        raise PaymentConfigError("The 'stripe' package is not installed. Run: pip install -r requirements.txt")
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


def create_checkout_session(order) -> dict:
    """Create a Stripe Checkout Session for an order. Returns {url, id}."""
    stripe = _client()

    amount_minor = int(round(float(order.total_charge) * 100))  # paise / cents
    short = str(order.id)[:8]

    session = stripe.checkout.Session.create(
        mode="payment",
        line_items=[{
            "quantity": 1,
            "price_data": {
                "currency": settings.CURRENCY,
                "unit_amount": amount_minor,
                "product_data": {
                    "name": f"Trace delivery · #{short}",
                    "description": f"{order.pickup_address[:40]} → {order.drop_address[:40]}",
                },
            },
        }],
        metadata={"order_id": str(order.id)},
        success_url=f"{settings.FRONTEND_URL}/orders/{order.id}?paid=1&session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{settings.FRONTEND_URL}/orders/{order.id}/pay?canceled=1",
    )
    return {"url": session.url, "id": session.id}


def confirm_session(session_id: str) -> tuple[bool, str | None]:
    """Retrieve a Checkout Session; return (is_paid, payment_intent_id)."""
    stripe = _client()
    session = stripe.checkout.Session.retrieve(session_id)
    paid = session.get("payment_status") == "paid"
    return paid, session.get("payment_intent")


def refund_payment(payment_intent_id: str) -> dict:
    """Refund a PaymentIntent in full. Returns the Stripe Refund object."""
    stripe = _client()
    refund = stripe.Refund.create(payment_intent=payment_intent_id)
    return {"id": refund.id, "status": refund.status}
