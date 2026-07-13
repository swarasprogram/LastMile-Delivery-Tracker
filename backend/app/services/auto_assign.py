import math
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.models import User, AgentProfile, Order

PROXIMITY_WEIGHT = 0.5
WORKLOAD_WEIGHT = 0.3
SUCCESS_WEIGHT = 0.2

# Agents without a live GPS fix are still assignable — they just get a neutral
# proximity score so distance can't be the sole deciding factor.
NEUTRAL_PROXIMITY = 0.5

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

    Every agent whose profile is available is a candidate — a live GPS location
    is used for proximity scoring when present, but is NOT required. This is what
    lets the load spread across the whole fleet instead of collapsing onto the one
    agent who happens to have shared their location.
    """
    # LEFT JOIN so agents that have no profile row yet are still considered.
    result = await db.execute(
        select(User, AgentProfile)
        .outerjoin(AgentProfile, AgentProfile.user_id == User.id)
        .where(User.role == "agent")
    )
    rows = result.all()

    # Available = no profile yet, or profile explicitly available.
    candidates = [
        (user, profile)
        for user, profile in rows
        if profile is None or profile.is_available is not False
    ]
    if not candidates:
        return None, 0.0, {}

    # --- Proximity: real distance where we have a location, else neutral ---
    raw_distances = []          # None when the agent has no live fix
    for _, profile in candidates:
        if profile is not None and profile.current_lat is not None and profile.current_lng is not None:
            raw_distances.append(
                haversine_km(pickup_lat, pickup_lng, float(profile.current_lat), float(profile.current_lng))
            )
        else:
            raw_distances.append(None)

    known = [d for d in raw_distances if d is not None]
    max_known = max(known) if known else 0
    prox_scores = []
    for d in raw_distances:
        if d is None:
            prox_scores.append(NEUTRAL_PROXIMITY)
        elif max_known:
            prox_scores.append(1 - (d / max_known))
        else:
            prox_scores.append(1.0)  # only agent(s), all at same/zero distance

    # --- Workload score (fewer active orders → higher score) ---
    workloads = []
    for user, _ in candidates:
        count_result = await db.execute(
            select(func.count(Order.id)).where(
                Order.agent_id == user.id,
                Order.status.in_(ACTIVE_STATUSES),
            )
        )
        workloads.append(count_result.scalar() or 0)
    workload_scores = _normalize_inverse(workloads)

    # --- Success rate score ---
    success_scores = []
    for _, profile in candidates:
        rate = float(profile.success_rate) / 100.0 if (profile and profile.success_rate is not None) else 0.5
        success_scores.append(max(0.0, min(1.0, rate)))

    # --- Composite score ---
    scored = []
    for i, (user, _) in enumerate(candidates):
        score = (
            PROXIMITY_WEIGHT * prox_scores[i]
            + WORKLOAD_WEIGHT * workload_scores[i]
            + SUCCESS_WEIGHT * success_scores[i]
        )
        breakdown = {
            "distance_km": round(raw_distances[i], 2) if raw_distances[i] is not None else 0.0,
            "has_live_location": raw_distances[i] is not None,
            "proximity_score": round(prox_scores[i], 3),
            "active_orders": workloads[i],
            "workload_score": round(workload_scores[i], 3),
            "success_rate": round(success_scores[i], 3),
            "composite_score": round(score, 3),
        }
        scored.append((user, score, breakdown))

    # Highest composite wins; break ties by fewest active orders for fair spread.
    scored.sort(key=lambda x: (x[1], -x[2]["active_orders"]), reverse=True)
    return scored[0]
