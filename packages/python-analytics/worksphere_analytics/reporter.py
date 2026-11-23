import io
import csv
import json
from typing import Iterator, Dict, Any
from .models import OrganizationAnalyticsSummary

def generate_streaming_csv(summary: OrganizationAnalyticsSummary) -> Iterator[str]:
    """Generates streaming CSV rows one by one."""
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow(["Metric", "Value"])
    yield output.getvalue()
    output.seek(0)
    output.truncate(0)

    # Metric Rows
    rows = [
        ("Organization ID", summary.organization_id),
        ("Health Score", f"{summary.health_score}/100"),
        ("Risk Level", summary.risk_level),
        ("Total Events Processed", summary.metrics.total_events_processed),
        ("Completed Tasks", summary.metrics.total_tasks_completed),
        ("Completion Rate", f"{summary.metrics.completion_rate_percentage}%"),
        ("Average Cycle Time (Hours)", summary.metrics.average_cycle_time_hours),
        ("Overdue Tasks", summary.metrics.total_overdue_tasks),
    ]

    for label, val in rows:
        writer.writerow([label, val])
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)

    # Throughput breakdown
    writer.writerow([])
    writer.writerow(["Assignee Throughput", "Completed Tasks"])
    yield output.getvalue()
    output.seek(0)
    output.truncate(0)

    for user, count in summary.metrics.throughput_by_assignee.items():
        writer.writerow([user, count])
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)

def generate_streaming_json(summary: OrganizationAnalyticsSummary) -> str:
    """Serializes summary to indented JSON string."""
    return summary.model_dump_json(indent=2)
