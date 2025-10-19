from sqlalchemy import delete

from phoenix.db import models
from phoenix.server.types import DbSessionFactory


async def delete_projects(
    db: DbSessionFactory,
    *project_names: str,
) -> list[int]:
    if not project_names:
        return []
    stmt = (
        delete(models.Project)
        .where(models.Project.name.in_(set(project_names)))
        .returning(models.Project.id)
    )
    async with db() as session:
        return list(await session.scalars(stmt))


async def delete_traces(
    db: DbSessionFactory,
    *trace_ids: str,
) -> list[int]:
    if not trace_ids:
        return []
    stmt = (
        delete(models.Trace)
        .where(models.Trace.trace_id.in_(set(trace_ids)))
        .returning(models.Trace.id)
    )
    async with db() as session:
        return list(await session.scalars(stmt))


def get_aws_model_inference_prefix(region: str) -> str:
    """
    Extract model inference profile prefix from the AWS region.
    For details see: https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html
    """
    try:
        prefix, *_ = region.split("-")
        prefix = prefix.lower()
        # special case for APAC, for example:
        # region: ap-northeast-1, model: apac.twelvelabs.pegasus-1-2-v1:0
        prefix = "apac" if prefix == "ap" else prefix
    except ValueError:
        prefix = ""

    return prefix
