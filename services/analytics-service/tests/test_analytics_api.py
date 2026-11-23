import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings

client = TestClient(app)

def test_health_endpoints():
    res_live = client.get("/health/live")
    assert res_live.status_code == 200
    assert res_live.json()["status"] == "live"

    res_ready = client.get("/health/ready")
    assert res_ready.status_code == 200
    assert res_ready.json()["status"] == "ready"

def test_unauthenticated_request_rejected():
    res = client.get("/api/v1/analytics/projects/proj-101/health")
    assert res.status_code == 401
    assert "Unauthorized" in res.json()["detail"]

def test_project_health_calculation_with_valid_key():
    headers = {"X-API-Key": settings.m2m_api_key}
    res = client.get(
        "/api/v1/analytics/projects/proj-101/health?total_tasks=25&completed_tasks=20&overdue_tasks=1",
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["project_id"] == "proj-101"
    assert data["completion_rate_percentage"] == 80.0
    assert data["health_score"] >= 80.0
    assert data["risk_level"] == "low"
    assert data["estimated_completion_date"] is not None

def test_batch_activity_processing():
    headers = {"Authorization": f"Bearer {settings.m2m_api_key}"}
    payload = {
        "organization_id": "org_analytics_test",
        "events": [
            {
                "id": "evt_10",
                "organization_id": "org_analytics_test",
                "entity_id": "task_100",
                "action": "status_changed",
                "status": "done",
            },
            {
                "id": "evt_11",
                "organization_id": "org_analytics_test",
                "entity_id": "task_101",
                "action": "created",
                "status": "todo",
            },
        ],
    }
    res = client.post("/api/v1/analytics/process-activity", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["processed_events"] == 2
    assert data["completed_count"] == 1

def test_organization_workload_endpoint():
    headers = {"X-API-Key": settings.m2m_api_key}
    res = client.get("/api/v1/analytics/organizations/org_analytics_test/workload", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["organization_id"] == "org_analytics_test"
    assert len(data["members"]) == 3
    # Check overloaded detection (>40 hrs)
    overloaded_members = [m for m in data["members"] if m["is_overloaded"]]
    assert len(overloaded_members) == 1
    assert overloaded_members[0]["user_id"] == "usr_bob_102"
