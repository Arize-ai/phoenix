from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def generate_aws_rds_token(
    host: str,
    port: int,
    user: str,
) -> str:
    """Generate an AWS RDS IAM authentication token.

    This function creates a short-lived (15 minutes) authentication token for connecting
    to AWS RDS/Aurora PostgreSQL instances using IAM database authentication.

    The AWS region is automatically resolved using boto3.

    Args:
        host: The database hostname (e.g., 'mydb.abc123.us-west-2.rds.amazonaws.com')
        port: The database port (typically 5432 for PostgreSQL)
        user: The database username (must match an IAM-enabled database user)

    Returns:
        A temporary authentication token string to use as the database password

    Raises:
        ImportError: If boto3 is not installed
        Exception: If AWS credentials/region are not configured or token generation fails

    Example:
        >>> token = generate_aws_rds_token(
        ...     host='mydb.us-west-2.rds.amazonaws.com',
        ...     port=5432,
        ...     user='myuser'
        ... )
    """
    try:
        import boto3  # type: ignore
    except ImportError as e:
        raise ImportError(
            "boto3 is required for AWS RDS IAM authentication. "
            "Install it with: pip install 'arize-phoenix[aws]'"
        ) from e

    try:
        client = boto3.client("rds")

        logger.debug(f"Generating AWS RDS IAM auth token for user '{user}' at {host}:{port}")
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
