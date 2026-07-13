from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    BREVO_API_KEY: str = ""
    SENDER_EMAIL: str = "noreply@deliverytracker.com"
    NOMINATIM_USER_AGENT: str = "delivery-tracker-app"

    # Stripe (test mode). Get free test keys at https://dashboard.stripe.com/test/apikeys
    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    CURRENCY: str = "inr"

    # Where the frontend runs — used for Stripe Checkout success/cancel redirects
    FRONTEND_URL: str = "http://localhost:5173"

    class Config:
        env_file = ".env"
        extra = "ignore"  # tolerate leftover keys (e.g. old Razorpay vars) in .env

settings = Settings()