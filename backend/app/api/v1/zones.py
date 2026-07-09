from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from geoalchemy2.shape import from_shape
from shapely.geometry import shape

from app.core.database import get_db
from app.core.deps import require_admin, get_current_user
from app.models.models import Zone, Area
from app.schemas.schemas import ZoneCreate, ZoneOut, AreaCreate, AreaOut

router = APIRouter()


@router.post("/", response_model=ZoneOut, status_code=201)
async def create_zone(
    payload: ZoneCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    boundary = None
    if payload.boundary:
        geom = shape(payload.boundary)
        boundary = from_shape(geom, srid=4326)

    zone = Zone(name=payload.name, boundary=boundary)
    db.add(zone)
    await db.commit()
    await db.refresh(zone)
    return zone


@router.get("/", response_model=list[ZoneOut])
async def list_zones(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Zone))
    return result.scalars().all()


@router.get("/{zone_id}", response_model=ZoneOut)
async def get_zone(zone_id: str, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Zone).where(Zone.id == zone_id))
    zone = result.scalar_one_or_none()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    return zone


@router.post("/{zone_id}/areas", response_model=AreaOut, status_code=201)
async def add_area(
    zone_id: str,
    payload: AreaCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    result = await db.execute(select(Zone).where(Zone.id == zone_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Zone not found")

    point = None
    if payload.lat and payload.lng:
        from shapely.geometry import Point
        point = from_shape(Point(payload.lng, payload.lat), srid=4326)

    area = Area(zone_id=zone_id, name=payload.name, point=point)
    db.add(area)
    await db.commit()
    await db.refresh(area)
    return area


@router.get("/{zone_id}/areas", response_model=list[AreaOut])
async def list_areas(zone_id: str, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Area).where(Area.zone_id == zone_id))
    return result.scalars().all()