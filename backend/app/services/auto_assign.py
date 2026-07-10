import math
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.models import User, AgentProfile, Order

PROXIMITY_WEIGHT = 0.5
WORKLOAD_WEIGHT = 0.3
SUCCESS_WEIGHT = 0.2

ACTIVE_STATUSES = {"confirmed", "agent_assigned", "picked_up", "in_transit", "out_for_delivery"}


def haversine_km(lat1, lng1, lat2, lng2) -> float:
    """Straight-line distance in km between two GPS points."""
    R = 6371
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _normalize_inverse(values: list[float]) -> list[float]:
    """Lower raw value → higher score. Returns scores in [0, 1]."""
    if not values:
        return []
    max_v = max(values) or 1
    return [1 - (v / max_v) for v in values]


async def find_best_agent(pickup_lat: float, pickup_lng: float, db: AsyncSession):
    """
    Returns (User, score, breakdown) for the best available agent,
    or (None, 0, {}) if no agents are available.
    """
    # Fetch all available agents with a location
    profile_result = await db.execute(
        select(AgentProfile, User)
        .join(User, User.id == AgentProfile.user_id)
        .where(
            AgentProfile.is_available == True,
            AgentProfile.current_lat.isnot(None),
            AgentProfile.current_lng.isnot(None),
        )
    )
    rows = profile_result.all()

    if not rows:
        return None, 0.0, {}

    agent_profiles = [(profile, user) for profile, user in rows]

    # --- Proximity score ---
    distances = [
        haversine_km(pickup_lat, pickup_lng, p.current_lat, p.current_lng)
        for p, _ in agent_profiles
    ]
    prox_scores = _normalize_inverse(distances)

    # --- Workload score (count active orders per agent) ---
    workloads = []
    for _, user in agent_profiles:
        count_result = await db.execute(
            select(func.count(Order.id))
            .where(
                Order.agent_id == user.id,
                Order.status.in_(ACTIVE_STATUSES),
            )
        )
        workloads.append(count_result.scalar() or 0)
    workload_scores = _normalize_inverse(workloads)

    # --- Success rate score ---
    success_scores = []
    for profile, _ in agent_profiles:
        rate = float(profile.success_rate) if profile.success_rate is not None else 0.5
        success_scores.append(rate)

    # --- Composite score ---
    scored = []
    for i, (profile, user) in enumerate(agent_profiles):
        score = (
            PROXIMITY_WEIGHT * prox_scores[i]
            + WORKLOAD_WEIGHT * workload_scores[i]
            + SUCCESS_WEIGHT * success_scores[i]
        )
        breakdown = {
            "distance_km": round(distances[i], 2),
            "proximity_score": round(prox_scores[i], 3),
            "active_orders": workloads[i],
            "workload_score": round(workload_scores[i], 3),
            "success_rate": round(success_scores[i], 3),
            "composite_score": round(score, 3),
        }
        scored.append((user, score, breakdown))

    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[0]