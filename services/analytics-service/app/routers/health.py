import os
import time
from fastapi import APIRouter

router = APIRouter(tags=["Health & Diagnostics"])
START_TIME = time.time()

@router.get("/health/live")
def liveness():
    return {
        "status": "live",
        "service": "worksphere-analytics",
        "uptime_seconds": round(time.time() - START_TIME, 2),
    }

@router.get("/health/ready")
def readiness():
    return {
        "status": "ready",
        "service": "worksphere-analytics",
        "dependencies": {
            "memory": "ok",
            "cpu": "ok"
        }
    }

