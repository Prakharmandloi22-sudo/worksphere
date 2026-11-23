from datetime import date, datetime
from typing import Dict, List, Optional
from .models import TaskActivityEvent

def calculate_cycle_time_hours(events_by_task: Dict[str, List[TaskActivityEvent]]) -> float:
    """Calculates average cycle time in hours from in_progress to done."""
    cycle_times: List[float] = []

    for task_id, events in events_by_task.items():
        started_at: Optional[datetime] = None
        completed_at: Optional[datetime] = None

        # Sort chronologically
        sorted_events = sorted(events, key=lambda e: e.timestamp)
        for ev in sorted_events:
            status_after = ev.diff.get("status", {}).get("after") if ev.diff else ev.status
            if status_after == "in_progress" and not started_at:
                started_at = ev.timestamp
            elif status_after == "done":
                completed_at = ev.timestamp

        if started_at and completed_at and completed_at >= started_at:
            delta_hours = (completed_at - started_at).total_seconds() / 3600.0
            cycle_times.append(delta_hours)

    if not cycle_times:
        return 0.0
    return round(sum(cycle_times) / len(cycle_times), 2)

def calculate_throughput_by_assignee(events: List[TaskActivityEvent]) -> Dict[str, int]:
    """Calculates throughput (completed tasks) per assignee/user."""
    throughput: Dict[str, int] = {}
    completed_task_ids = set()

    for ev in events:
        status_after = ev.diff.get("status", {}).get("after") if ev.diff else ev.status
        if status_after == "done" and ev.entity_id not in completed_task_ids:
            completed_task_ids.add(ev.entity_id)
            user = ev.user_id or "unassigned"
            throughput[user] = throughput.get(user, 0) + 1

    return throughput

def detect_overdue_tasks(
    latest_task_states: Dict[str, TaskActivityEvent],
    as_of: Optional[date] = None
) -> List[str]:
    """Identifies task IDs that are past due and not completed."""
    ref_date = as_of or date.today()
    overdue_ids: List[str] = []

    for task_id, task in latest_task_states.items():
        if task.status != "done" and task.due_date and task.due_date < ref_date:
            overdue_ids.append(task_id)

    return overdue_ids

def compute_health_score(
    completion_rate: float,
    overdue_count: int,
    total_active: int
) -> tuple[float, str]:
    """Computes project/org health score (0-100) and risk level."""
    score = 100.0

    # Overdue penalty
    if total_active > 0:
        overdue_ratio = overdue_count / max(total_active, 1)
        score -= overdue_ratio * 40.0

    # Completion reward/penalty
    score -= (100.0 - completion_rate) * 0.3

    score = max(0.0, min(100.0, round(score, 1)))

    if score >= 80:
        risk = "low"
    elif score >= 60:
        risk = "medium"
    elif score >= 40:
        risk = "high"
    else:
        risk = "critical"

    return score, risk
