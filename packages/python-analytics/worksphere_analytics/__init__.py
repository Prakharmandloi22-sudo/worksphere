"""WorkSphere Analytics Package - High-performance streaming activity processor."""

from .models import TaskActivityEvent, ProductivityMetrics, OrganizationAnalyticsSummary
from .processor import StreamActivityProcessor
from .metrics import calculate_cycle_time_hours, calculate_throughput_by_assignee, detect_overdue_tasks
from .reporter import generate_streaming_csv, generate_streaming_json

__all__ = [
    "TaskActivityEvent",
    "ProductivityMetrics",
    "OrganizationAnalyticsSummary",
    "StreamActivityProcessor",
    "calculate_cycle_time_hours",
    "calculate_throughput_by_assignee",
    "detect_overdue_tasks",
    "generate_streaming_csv",
    "generate_streaming_json",
]
