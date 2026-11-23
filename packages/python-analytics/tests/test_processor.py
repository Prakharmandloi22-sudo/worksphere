import pytest
from datetime import datetime, date
from worksphere_analytics.processor import StreamActivityProcessor
from worksphere_analytics.reporter import generate_streaming_csv, generate_streaming_json

def test_stream_processor_success():
    org_id = "org_test_100"
    processor = StreamActivityProcessor(organization_id=org_id)

    raw_events = [
        {
            "id": "evt_1",
            "organization_id": org_id,
            "entity_id": "task_1",
            "entity_type": "task",
            "user_id": "user_alice",
            "action": "created",
            "status": "todo",
            "due_date": "2026-03-01",
            "timestamp": "2026-02-01T09:00:00",
        },
        {
            "id": "evt_2",
            "organization_id": org_id,
            "entity_id": "task_1",
            "entity_type": "task",
            "user_id": "user_alice",
            "action": "status_changed",
            "status": "in_progress",
            "timestamp": "2026-02-01T10:00:00",
            "diff": {"status": {"before": "todo", "after": "in_progress"}},
        },
        {
            "id": "evt_3",
            "organization_id": org_id,
            "entity_id": "task_1",
            "entity_type": "task",
            "user_id": "user_alice",
            "action": "status_changed",
            "status": "done",
            "timestamp": "2026-02-01T14:00:00",
            "diff": {"status": {"before": "in_progress", "after": "done"}},
        },
    ]

    summary = processor.process_stream(iter(raw_events))

    assert summary.organization_id == org_id
    assert summary.metrics.total_events_processed == 3
    assert summary.metrics.total_tasks_completed == 1
    assert summary.metrics.average_cycle_time_hours == 4.0
    assert summary.metrics.throughput_by_assignee.get("user_alice") == 1
    assert summary.metrics.completion_rate_percentage == 100.0

def test_stream_processor_filters_cross_tenant_events():
    org_id = "org_target"
    processor = StreamActivityProcessor(organization_id=org_id)

    raw_events = [
        {
            "id": "evt_foreign",
            "organization_id": "org_other_tenant",
            "entity_id": "task_foreign",
            "action": "created",
            "status": "todo",
            "timestamp": "2026-02-01T09:00:00",
        },
        {
            "id": "evt_own",
            "organization_id": org_id,
            "entity_id": "task_own",
            "action": "created",
            "status": "todo",
            "timestamp": "2026-02-01T09:00:00",
        },
    ]

    summary = processor.process_stream(iter(raw_events))
    assert summary.metrics.total_events_processed == 2
    # Only own task should be in summary
    assert summary.metrics.total_tasks_completed == 0

def test_stream_processor_invalid_payload_validation():
    org_id = "org_test"
    processor = StreamActivityProcessor(organization_id=org_id)

    # Missing mandatory 'id' field
    invalid_event = [{"organization_id": org_id, "entity_id": "task_invalid"}]

    with pytest.raises(Exception):
        processor.process_stream(iter(invalid_event))

def test_csv_and_json_reporters():
    org_id = "org_report_test"
    processor = StreamActivityProcessor(organization_id=org_id)
    summary = processor.process_stream(iter([]))

    csv_lines = list(generate_streaming_csv(summary))
    assert len(csv_lines) > 0
    assert "Metric,Value" in csv_lines[0]

    json_str = generate_streaming_json(summary)
    assert f'"organization_id": "{org_id}"' in json_str
