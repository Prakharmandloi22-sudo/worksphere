from datetime import datetime, date
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

class TaskActivityEvent(BaseModel):
    id: str
    organization_id: str
    entity_id: str
    entity_type: str = "task"
    user_id: Optional[str] = None
    action: str  # 'created', 'updated', 'status_changed', 'deleted'
    status: Optional[str] = None
    priority: Optional[str] = "medium"
    due_date: Optional[date] = None
    estimated_hours: float = 0.0
    actual_hours: float = 0.0
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    diff: Dict[str, Any] = Field(default_factory=dict)

class ProductivityMetrics(BaseModel):
    total_events_processed: int
    total_tasks_completed: int
    average_cycle_time_hours: float
    total_overdue_tasks: int
    throughput_by_assignee: Dict[str, int]
    completion_rate_percentage: float

class OrganizationAnalyticsSummary(BaseModel):
    organization_id: str
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    metrics: ProductivityMetrics
    health_score: float  # 0 to 100
    risk_level: str  # 'low', 'medium', 'high', 'critical'

