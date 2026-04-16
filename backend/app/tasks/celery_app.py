from celery import Celery
from app.config import settings

celery = Celery(
    "sochmate",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.tasks.analysis"],
)

celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    # Prevent analysis tasks from silently sitting in the queue forever
    task_soft_time_limit=300,   # 5 minutes — raises SoftTimeLimitExceeded
    task_time_limit=360,        # 6 minutes — hard kill
)
