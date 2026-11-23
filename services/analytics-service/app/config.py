import os
from pydantic import BaseModel

class Settings(BaseModel):
    app_name: str = "WorkSphere Analytics Service"
    env: str = os.getenv("ENV", "development")
    port: int = int(os.getenv("PORT", "8000"))
    m2m_api_key: str = os.getenv("ANALYTICS_SERVICE_API_KEY", "m2m-service-token-worksphere-analytics-2026")

settings = Settings()

