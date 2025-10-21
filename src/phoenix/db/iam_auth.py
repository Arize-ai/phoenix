from __future__ import annotations

import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)


def generate_aws_rds_token(
    host: str,
    port: int,
    user: str,
    region: Optional[str] = None,
) -> str:
    """Generate an AWS RDS IAM authentication token.

    This function creates a short-lived (15 minutes) authentication token for connecting
    to AWS RDS/Aurora PostgreSQL instances using IAM database authentication.

    Args:
        host: The database hostname (e.g., 'mydb.abc123.us-west-2.rds.amazonaws.com')
        port: The database port (typically 5432 for PostgreSQL)
        user: The database username (must match an IAM-enabled database user)
        region: AWS region (optional). If not provided, attempts to auto-detect from hostname
                or uses boto3's default region resolution.

    Returns:
        A temporary authentication token string to use as the database password

    Raises:
        ImportError: If boto3 is not installed
        Exception: If AWS credentials are not configured or token generation fails

    Example:
        >>> token = generate_aws_rds_token(
        ...     host='mydb.us-west-2.rds.amazonaws.com',
        ...     port=5432,
        ...     user='myuser',
        ...     region='us-west-2'
        ... )
    """
    try:
        import boto3  # pyright: ignore
    except ImportError as e:
        raise ImportError(
            "boto3 is required for AWS RDS IAM authentication. "
            "Install it with: pip install 'arize-phoenix[aws]'"
        ) from e

    if region is None:
        region = _extract_region_from_rds_host(host)
        if region:
            logger.debug(f"Auto-detected AWS region '{region}' from RDS hostname")

    try:
        client = boto3.client("rds", region_name=region)

        logger.debug(
            f"Generating AWS RDS IAM auth token for user '{user}' at {host}:{port}"
        )
        token = client.generate_db_auth_token(  # pyright: ignore
            DBHostname=host,
            Port=port,
            DBUsername=user,
        )

        return str(token)  # pyright: ignore

    except Exception as e:
        logger.error(
            f"Failed to generate AWS RDS IAM authentication token: {e}. "
            "Ensure AWS credentials are configured and have 'rds-db:connect' permission."
        )
        raise


def _extract_region_from_rds_host(host: str) -> Optional[str]:
    """Extract AWS region from RDS/Aurora hostname.

    Parses hostnames matching AWS RDS patterns to extract the region identifier.

    Supported patterns:
    - Standard RDS: <instance>.<identifier>.<region>.rds.amazonaws.com
    - Aurora cluster: <cluster>.cluster-<id>.<region>.rds.amazonaws.com
    - Aurora instance: <instance>.<cluster>.<region>.rds.amazonaws.com

    Args:
        host: The database hostname

    Returns:
        The AWS region code (e.g., 'us-west-2') or None if not recognizable

    Examples:
        >>> _extract_region_from_rds_host('mydb.abc123.us-west-2.rds.amazonaws.com')
        'us-west-2'
        >>> _extract_region_from_rds_host('mydb.cluster-abc.eu-central-1.rds.amazonaws.com')
        'eu-central-1'
        >>> _extract_region_from_rds_host('localhost')
        None
    """
    region_pattern = r"\.([a-z]{2,}-[a-z]+-\d+)\.rds\.amazonaws\.com"

    match = re.search(region_pattern, host, re.IGNORECASE)
    if match:
        return match.group(1)

    return None

