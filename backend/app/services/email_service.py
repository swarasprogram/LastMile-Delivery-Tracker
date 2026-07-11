import httpx
from app.core.config import settings
 
 
async def send_failure_email(customer_email: str, customer_name: str, order_id: str, pickup: str, drop: str, note: str = ""):
    """Send delivery failure notification via Brevo."""
    if not settings.BREVO_API_KEY:
        return  # Skip if not configured
 
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee">
      <div style="background:#DC2626;padding:24px;text-align:center">
        <p style="color:white;font-size:32px;margin:0">❌</p>
        <h1 style="color:white;margin:8px 0 0;font-size:20px">Delivery Failed</h1>
      </div>
      <div style="padding:28px">
        <p style="color:#374151">Hi <strong>{customer_name}</strong>,</p>
        <p style="color:#6B7280">Unfortunately, your delivery could not be completed.</p>
        <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:16px;margin:20px 0">
          <p style="margin:0 0 8px;color:#374151"><strong>📍 From:</strong> {pickup}</p>
          <p style="margin:0 0 8px;color:#374151"><strong>🏠 To:</strong> {drop}</p>
          {f'<p style="margin:0;color:#6B7280"><strong>Reason:</strong> {note}</p>' if note else ''}
        </div>
        <p style="color:#6B7280">You can reschedule your delivery from the tracking page.</p>
        <a href="http://localhost:5174/orders/{order_id}"
           style="display:inline-block;background:#2563EB;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">
          Reschedule Delivery →
        </a>
        <p style="color:#9CA3AF;font-size:12px;margin-top:24px">Last-Mile Delivery Tracker · Automated notification</p>
      </div>
    </div>
    """
 
    payload = {
        "sender": {"name": "Last-Mile Tracker", "email": settings.SENDER_EMAIL},
        "to": [{"email": customer_email, "name": customer_name}],
        "subject": "⚠️ Your delivery attempt failed – Reschedule now",
        "htmlContent": html,
    }
 
    async with httpx.AsyncClient() as http:
        await http.post(
            "https://api.brevo.com/v3/smtp/email",
            json=payload,
            headers={"api-key": settings.BREVO_API_KEY, "Content-Type": "application/json"},
            timeout=10,
        )
 