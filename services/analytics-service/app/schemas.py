from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class TaskActivityInput(BaseModel):
    id: str
    organization_id: str
    entity_id: str
    user_id: Optional[str] = None
    action: str
    status: Optional[str] = None
    priority: Optional[str] = "medium"
    due_date: Optional[date] = None
    estimated_hours: float = 0.0
    actual_hours: float = 0.0
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    diff: Dict[str, Any] = Field(default_factory=dict)

class ProcessActivityBatchRequest(BaseModel):
    organization_id: str
    events: List[TaskActivityInput]

class HealthMetricsResponse(BaseModel):
    project_id: str
    health_score: float
    risk_level: str
    total_tasks: int
    completed_tasks: int
    overdue_tasks: int
    completion_rate_percentage: float
    estimated_completion_date: Optional[date] = None

class WorkloadMemberSummary(BaseModel):
    user_id: str
    assigned_tasks_count: int
    estimated_hours_total: float
    capacity_percentage: float
    is_overloaded: bool

class OrganizationWorkloadResponse(BaseModel):
    organization_id: str
    members: List[WorkloadMemberSummary]
    unassigned_tasks_count: int
