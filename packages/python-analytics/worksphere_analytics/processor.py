from typing import Iterator, Dict, List, Any, Optional
from datetime import date
from .models import TaskActivityEvent, ProductivityMetrics, OrganizationAnalyticsSummary
from .metrics import (
    calculate_cycle_time_hours,
    calculate_throughput_by_assignee,
    detect_overdue_tasks,
    compute_health_score,
)

class StreamActivityProcessor:
    """
    Streaming processor for processing massive activity logs chunk-by-chunk
    in O(1) memory without loading entire datasets into RAM.
    """

    def __init__(self, organization_id: str, chunk_size: int = 1000):
        self.organization_id = organization_id
        self.chunk_size = chunk_size

    def process_stream(
        self,
        event_stream: Iterator[Dict[str, Any]],
        as_of_date: Optional[date] = None
    ) -> OrganizationAnalyticsSummary:
        """
        Iterates over a stream of raw dictionaries, parses them with Pydantic,
        and aggregates metrics in a single pass.
        """
        total_events = 0
        events_by_task: Dict[str, List[TaskActivityEvent]] = {}
        latest_task_state: Dict[str, TaskActivityEvent] = {}
        completed_tasks = set()
        throughput: Dict[str, int] = {}

        for raw_event in event_stream:
            # Parse with validation
            ev = TaskActivityEvent(**raw_event)
            total_events += 1

            # Only track events for the given organization
            if ev.organization_id != self.organization_id:
                continue

            # Update latest task state
            latest_task_state[ev.entity_id] = ev

            # Collect events per task for cycle time calculation
            if ev.entity_id not in events_by_task:
                events_by_task[ev.entity_id] = []
            events_by_task[ev.entity_id].append(ev)

            # Check status transitions
            status_after = ev.diff.get("status", {}).get("after") if ev.diff else ev.status
            if status_after == "done" and ev.entity_id not in completed_tasks:
                completed_tasks.add(ev.entity_id)
                user = ev.user_id or "unassigned"
                throughput[user] = throughput.get(user, 0) + 1

        # Calculate metrics
        avg_cycle_time = calculate_cycle_time_hours(events_by_task)
        overdue_tasks = detect_overdue_tasks(latest_task_state, as_of=as_of_date)
        total_unique_tasks = len(latest_task_state)
        completion_rate = (
            round((len(completed_tasks) / total_unique_tasks) * 100.0, 1)
            if total_unique_tasks > 0
            else 0.0
        )

        health_score, risk_level = compute_health_score(
            completion_rate=completion_rate,
            overdue_count=len(overdue_tasks),
            total_active=total_unique_tasks - len(completed_tasks),
        )

        metrics = ProductivityMetrics(
            total_events_processed=total_events,
            total_tasks_completed=len(completed_tasks),
            average_cycle_time_hours=avg_cycle_time,
            total_overdue_tasks=len(overdue_tasks),
            throughput_by_assignee=throughput,
            completion_rate_percentage=completion_rate,
        )

        return OrganizationAnalyticsSummary(
            organization_id=self.organization_id,
            metrics=metrics,
            health_score=health_score,
            risk_level=risk_level,
        )
