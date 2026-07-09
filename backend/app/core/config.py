from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    BREVO_API_KEY: str = ""
    SENDER_EMAIL: str = "noreply@deliverytracker.com"
    NOMINATIM_USER_AGENT: str = "delivery-tracker-app"

    class Config:
        env_file = ".env"

settings = Settings()