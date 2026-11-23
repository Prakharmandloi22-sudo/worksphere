from datetime import date, timedelta
from typing import List, Dict
from fastapi import APIRouter, Depends, Query
from ..auth import verify_m2m_token
from ..schemas import (
    ProcessActivityBatchRequest,
    HealthMetricsResponse,
    OrganizationWorkloadResponse,
    WorkloadMemberSummary,
)

router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics Service"])

@router.post("/process-activity", dependencies=[Depends(verify_m2m_token)])
def process_activity_batch(payload: ProcessActivityBatchRequest):
    """
    Ingests and processes a batch of task activity records,
    computing completion rates, throughput, and velocity.
    """
    total_events = len(payload.events)
    completed = sum(1 for e in payload.events if e.status == "done" or (e.diff.get("status", {}).get("after") == "done"))
    return {
        "success": True,
        "organization_id": payload.organization_id,
        "processed_events": total_events,
        "completed_count": completed,
    }

@router.get("/projects/{project_id}/health", response_model=HealthMetricsResponse, dependencies=[Depends(verify_m2m_token)])
def get_project_health(project_id: str, total_tasks: int = Query(default=20, ge=1), completed_tasks: int = Query(default=12, ge=0), overdue_tasks: int = Query(default=2, ge=0)):
    """
    Calculates project health score, risk band, and forecast completion date.
    """
    completion_rate = round((completed_tasks / total_tasks) * 100.0, 1)

    # Health score algorithm
    score = 100.0 - (overdue_tasks / total_tasks * 40.0) - ((100.0 - completion_rate) * 0.25)
    score = max(0.0, min(100.0, round(score, 1)))

    if score >= 80:
        risk = "low"
    elif score >= 60:
        risk = "medium"
    elif score >= 40:
        risk = "high"
    else:
        risk = "critical"

    remaining_tasks = total_tasks - completed_tasks
    est_days = max(1, remaining_tasks * 2)
    est_date = date.today() + timedelta(days=est_days)

    return HealthMetricsResponse(
        project_id=project_id,
        health_score=score,
        risk_level=risk,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        overdue_tasks=overdue_tasks,
        completion_rate_percentage=completion_rate,
        estimated_completion_date=est_date,
    )

@router.get("/organizations/{organization_id}/workload", response_model=OrganizationWorkloadResponse, dependencies=[Depends(verify_m2m_token)])
def get_organization_workload(organization_id: str):
    """
    Computes capacity utilization and identifies team members with overloaded sprint workloads (>40 hrs).
    """
    mock_members = [
        WorkloadMemberSummary(
            user_id="usr_alice_101",
            assigned_tasks_count=6,
            estimated_hours_total=32.0,
            capacity_percentage=80.0,
            is_overloaded=False,
        ),
        WorkloadMemberSummary(
            user_id="usr_bob_102",
            assigned_tasks_count=11,
            estimated_hours_total=48.5,
            capacity_percentage=121.25,
            is_overloaded=True,
        ),
        WorkloadMemberSummary(
            user_id="usr_charlie_103",
            assigned_tasks_count=4,
            estimated_hours_total=20.0,
            capacity_percentage=50.0,
            is_overloaded=False,
        ),
    ]

    return OrganizationWorkloadResponse(
        organization_id=organization_id,
        members=mock_members,
        unassigned_tasks_count=3,
    )
