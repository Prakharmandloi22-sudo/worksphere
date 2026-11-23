import time
import tracemalloc
from datetime import datetime, timedelta, date
from typing import Iterator, Dict, Any
from .processor import StreamActivityProcessor
from .reporter import generate_streaming_csv

def generate_synthetic_event_stream(num_events: int = 50_000, org_id: str = "org_benchmark_001") -> Iterator[Dict[str, Any]]:
    """Generates a synthetic generator stream of activity events simulating real workload."""
    users = ["user_alice", "user_bob", "user_charlie", "user_diana"]
    statuses = ["todo", "in_progress", "review", "done"]
    base_time = datetime(2026, 1, 1, 9, 0, 0)

    for i in range(num_events):
        task_id = f"task_{i % 5000}"
        user_id = users[i % len(users)]
        status = statuses[i % len(statuses)]
        timestamp = base_time + timedelta(minutes=i * 2)

        yield {
            "id": f"evt_{i}",
            "organization_id": org_id,
            "entity_id": task_id,
            "entity_type": "task",
            "user_id": user_id,
            "action": "status_changed",
            "status": status,
            "priority": "high" if i % 10 == 0 else "medium",
            "due_date": str(date(2026, 1, 15) if i % 20 == 0 else date(2026, 2, 28)),
            "estimated_hours": 8.0,
            "actual_hours": 6.5,
            "timestamp": timestamp.isoformat(),
            "diff": {
                "status": {
                    "before": "todo",
                    "after": status
                }
            }
        }

def run_benchmark(num_events: int = 20_000):
    print(f"\n=======================================================")
    print(f"WorkSphere Analytics Benchmark: Processing {num_events} Events")
    print(f"=======================================================")

    org_id = "org_benchmark_001"
    processor = StreamActivityProcessor(organization_id=org_id)

    tracemalloc.start()
    start_time = time.perf_counter()

    stream = generate_synthetic_event_stream(num_events=num_events, org_id=org_id)
    summary = processor.process_stream(stream, as_of_date=date(2026, 2, 1))

    end_time = time.perf_counter()
    current_mem, peak_mem = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    duration = end_time - start_time
    events_per_sec = num_events / duration if duration > 0 else 0

    print(f"Duration:                  {duration:.3f} seconds")
    print(f"Throughput:                {events_per_sec:,.0f} events/sec")
    print(f"Peak Memory Allocated:     {peak_mem / 1024 / 1024:.2f} MB")
    print(f"Processed Events:          {summary.metrics.total_events_processed:,}")
    print(f"Completed Tasks:           {summary.metrics.total_tasks_completed:,}")
    print(f"Overdue Tasks Detected:    {summary.metrics.total_overdue_tasks:,}")
    print(f"Health Score:              {summary.health_score} / 100 ({summary.risk_level} risk)")
    print(f"=======================================================\n")

    return {
        "num_events": num_events,
        "duration_sec": duration,
        "throughput_eps": events_per_sec,
        "peak_memory_mb": peak_mem / 1024 / 1024,
        "summary": summary,
    }

if __name__ == "__main__":
    run_benchmark(20_000)
