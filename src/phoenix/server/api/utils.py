import re

from sqlalchemy import delete

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

# See: https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions.html
AWS_REGION_PREFIXES = ["af", "ap", "ca", "eu", "il", "mx", "me", "sa", "us"]
# See: https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html
AWS_MODEL_PREFIXES = ["apac", "au", "ca", "eu", "global", "jp", "us", "us-gov"]
AWS_BEDROCK_REGION_PREFIX_PATTERN = re.compile(rf"^({'|'.join(AWS_MODEL_PREFIXES)})\.")

AWS_REGION_PREFIX_TO_MODEL_PREFIX_MAPPING = {
    "af": ["eu"],
    "ap": ["apac", "au", "global", "jp"],
    "ca": ["ca"],
    "eu": ["eu", "global"],
    "il": ["il", "eu"],
    "mx": ["global"],
    "me": ["apac"],
    "sa": ["global"],
    "us": ["us", "global"],
    "us-gov": ["us-gov"],
}


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


def match_aws_model_inference_prefix(
    model_name: str, prefix_pattern: re.Pattern = AWS_BEDROCK_REGION_PREFIX_PATTERN
) -> str:
    """
    Match model inference profile prefix in the model name.
    """
    match = prefix_pattern.match(model_name)
    if match:
        return match.group(0).rstrip(".")
    return ""


def get_aws_region_prefix(region: str) -> str:
    """
    Extract region prefix.
    """
    try:
        prefix, rest, *_ = region.split("-")
        prefix, rest = prefix.lower(), rest.lower()
        # special handling for "us-gov-*"
        if prefix == "us" and rest == "gov":
            prefix = "us-gov"
    except ValueError:
        prefix = ""

    return prefix


def get_aws_full_model_name(model_name: str, region: str) -> str:
    """
    Determine the full AWS model name including inference profile prefix.
    If the model name already includes a valid prefix, return it as is.
    Otherwise, prepend the appropriate prefix based on the region.
    """
    model_prefix = match_aws_model_inference_prefix(model_name)
    if model_prefix:
        return model_name

    possible_model_prefixes = AWS_REGION_PREFIX_TO_MODEL_PREFIX_MAPPING.get(
        get_aws_region_prefix(region)
    )

    if possible_model_prefixes:
        return f"{possible_model_prefixes[0]}.{model_name}"
    return model_name
