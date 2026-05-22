from pydantic import BaseModel


class DashboardStats(BaseModel):
    total: int = 0
    present: int = 0
    late: int = 0
    absent: int = 0


class WeeklyStats(BaseModel):
    day: str
    present: int = 0
    late: int = 0
    absent: int = 0
