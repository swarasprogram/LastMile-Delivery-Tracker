import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.models.models import Zone, Area

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


async def geocode_address(address: str) -> tuple[float | None, float | None, str | None]:
    """Returns (lat, lng, city) from address string."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(NOMINATIM_URL, params={
                "q": address, "format": "json", "limit": 1,
                "addressdetails": 1,
            }, headers={"User-Agent": "LastMileDeliveryTracker/1.0"})
            results = r.json()
            if not results:
                return None, None, None
            top = results[0]
            addr = top.get("address", {})
            city = (
                addr.get("city") or addr.get("town") or
                addr.get("village") or addr.get("county") or
                addr.get("state_district") or addr.get("state")
            )
            return float(top["lat"]), float(top["lon"]), city
    except Exception:
        return None, None, None


async def detect_zone_by_coords(lat: float, lng: float, db: AsyncSession):
    """PostGIS ST_Contains lookup."""
    try:
        result = await db.execute(
            text("SELECT id FROM zones WHERE ST_Contains(boundary, ST_MakePoint(:lng, :lat)::geography::geometry) LIMIT 1"),
            {"lat": lat, "lng": lng}
        )
        row = result.fetchone()
        return row[0] if row else None
    except Exception:
        return None


async def detect_zone_by_area_name(address: str, db: AsyncSession):
    """Fuzzy match on area name."""
    words = [w.strip() for w in address.replace(",", " ").split() if len(w.strip()) > 3]
    for word in words:
        result = await db.execute(
            select(Area).where(Area.name.ilike(f"%{word}%"))
        )
        area = result.scalar_one_or_none()
        if area and area.zone_id:
            return area.zone_id
    return None


async def get_or_create_zone_for_city(city: str, db: AsyncSession):
    if not city:
        return None
    result = await db.execute(
        select(Zone).where(Zone.name.ilike(f"%{city}%"))
    )
    zone = result.scalar_one_or_none()
    if zone:
        return zone.id

    new_zone = Zone(name=city)
    db.add(new_zone)
    await db.flush()

    new_area = Area(name=city, zone_id=new_zone.id)
    db.add(new_area)
    await db.flush()

    return new_zone.id


async def resolve_zone(address: str, lat: float | None, lng: float | None, db: AsyncSession):
    """
    Strategy:
    1. If lat/lng provided → PostGIS lookup
    2. Geocode address → PostGIS lookup
    3. Area name fuzzy match
    4. Auto-create zone from city name (so any address works)
    """
    # Use provided coords first
    if lat and lng:
        zone_id = await detect_zone_by_coords(lat, lng, db)
        if zone_id:
            return zone_id, lat, lng

    # Geocode
    geo_lat, geo_lng, city = await geocode_address(address)
    if geo_lat:
        lat, lng = geo_lat, geo_lng
        zone_id = await detect_zone_by_coords(lat, lng, db)
        if zone_id:
            return zone_id, lat, lng

    # Area name fuzzy match
    zone_id = await detect_zone_by_area_name(address, db)
    if zone_id:
        return zone_id, lat, lng

    # Auto-create zone from city
    zone_id = await get_or_create_zone_for_city(city, db)
    if zone_id:
        await db.commit()
        return zone_id, lat, lng

    return None, lat, lng