from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut
from app.core.config import settings


geocoder = Nominatim(user_agent=settings.NOMINATIM_USER_AGENT)


async def geocode_address(address: str) -> tuple[float, float] | None:
    """Convert address string to (lat, lng). Returns None if not found."""
    try:
        location = geocoder.geocode(address, timeout=10)
        if location:
            return (location.latitude, location.longitude)
        return None
    except GeocoderTimedOut:
        return None


async def detect_zone_by_coords(lat: float, lng: float, db: AsyncSession) -> str | None:
    """Find zone ID whose polygon contains the given coordinates."""
    result = await db.execute(
        text("""
            SELECT id FROM zones
            WHERE ST_Contains(
                boundary,
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)
            )
            LIMIT 1
        """),
        {"lat": lat, "lng": lng}
    )
    row = result.first()
    return str(row[0]) if row else None


async def detect_zone_by_area_name(address: str, db: AsyncSession) -> str | None:
    """Fallback: match address against known area names."""
    result = await db.execute(
        text("""
            SELECT zone_id FROM areas
            WHERE :address ILIKE '%' || name || '%'
            LIMIT 1
        """),
        {"address": address}
    )
    row = result.first()
    return str(row[0]) if row else None


async def resolve_zone(address: str, lat: float | None, lng: float | None, db: AsyncSession) -> tuple[str | None, float | None, float | None]:
    """
    Returns (zone_id, lat, lng).
    Strategy: PostGIS polygon check → area name fallback → None
    """
    # If coords provided, use them directly
    if lat and lng:
        zone_id = await detect_zone_by_coords(lat, lng, db)
        if zone_id:
            return zone_id, lat, lng

    # Geocode the address
    coords = await geocode_address(address)
    if coords:
        lat, lng = coords
        zone_id = await detect_zone_by_coords(lat, lng, db)
        if zone_id:
            return zone_id, lat, lng

    # Fallback: area name matching
    zone_id = await detect_zone_by_area_name(address, db)
    return zone_id, lat, lng