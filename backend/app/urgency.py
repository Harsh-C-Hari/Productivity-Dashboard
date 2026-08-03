"""
Smart Urgency engine.

Combines three signals into a single urgency tier:
  1. Remaining time until the deadline
  2. Estimated effort still outstanding (effort * (1 - progress))
  3. How that outstanding effort compares to the remaining time
     ("time pressure" - a ratio > 1 means there isn't enough time left
     to finish at a normal pace)

The tiers are intentionally simple to reason about (Critical/High/
Medium/Low) so badges stay predictable for the user, while the
underlying score still blends multiple factors instead of just
looking at the raw deadline.
"""
from datetime import datetime
from enum import Enum
from typing import Optional

from .timeutils import utc_now


class Urgency(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"
    none = "none"  # completed tasks, or tasks without a deadline


def compute_urgency(
    deadline: Optional[datetime],
    estimated_effort_hours: float,
    progress: int,
    status: str,
    now: Optional[datetime] = None,
) -> str:
    if status == "done":
        return Urgency.none.value

    if deadline is None:
        # No deadline set: base urgency purely on how much work is left.
        remaining_effort = estimated_effort_hours * (1 - progress / 100)
        if remaining_effort >= 8:
            return Urgency.medium.value
        return Urgency.low.value

    now = now or utc_now()
    remaining_hours = (deadline - now).total_seconds() / 3600.0

    if remaining_hours <= 0:
        return Urgency.critical.value  # overdue

    remaining_days = remaining_hours / 24.0
    remaining_effort_hours = max(estimated_effort_hours * (1 - progress / 100), 0)

    # Time pressure: ratio of work left to time left. >= 1 means the
    # task cannot realistically be finished working at a 1:1 pace.
    time_pressure = remaining_effort_hours / max(remaining_hours, 0.5)

    if time_pressure >= 0.7 or remaining_days <= 1:
        return Urgency.critical.value
    if time_pressure >= 0.4 or remaining_days <= 3:
        return Urgency.high.value
    if time_pressure >= 0.15 or remaining_days <= 7:
        return Urgency.medium.value
    return Urgency.low.value
