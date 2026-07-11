from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import auth, zones, rate_cards, orders, agents
from app.api.v1 import payments


app = FastAPI(title="Last-Mile Delivery Tracker", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,       prefix="/api/v1/auth",       tags=["Auth"])
app.include_router(zones.router,      prefix="/api/v1/zones",      tags=["Zones"])
app.include_router(rate_cards.router, prefix="/api/v1/rate-cards", tags=["Rate Cards"])
app.include_router(orders.router,     prefix="/api/v1/orders",     tags=["Orders"])
app.include_router(agents.router, prefix="/api/v1/agents", tags=["Agents"])
app.include_router(payments.router, prefix="/api/v1/payments", tags=["payments"])

@app.get("/health")
async def health():
    return {"status": "ok"}