"""Per-deployment seed and HKDF derivation of purpose-specific keys.

``deployment_identity`` is read only here.
"""

import secrets

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from pydantic import SecretStr
from sqlalchemy import select

from phoenix.db import models
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.types import DbSessionFactory

# Purpose labels. Each label is unique and is never reused for a different purpose.
REDACTION_KEY_PURPOSE = b"phoenix/redaction/v1"
TOKEN_SIGNING_KEY_PURPOSE = b"phoenix/token-signing/v1"

_HKDF_SALT = b"phoenix-deployment-v1"
_SEED_LENGTH = 32
_PK_CONSTRAINT = "pk_deployment_identity"


async def load_deployment_seed(db: DbSessionFactory) -> bytes:
    """Return the deployment seed, inserting the row when it is absent.

    Concurrent callers converge on one row.

    Returns:
        The 32-byte seed.
    """
    seed_stmt = select(models.DeploymentIdentity.seed).where(models.DeploymentIdentity.id == 1)
    async with db() as session:
        stored = await session.scalar(seed_stmt)
        if stored is None:
            await session.execute(
                insert_on_conflict(
                    {"id": 1, "seed": secrets.token_bytes(_SEED_LENGTH)},
                    table=models.DeploymentIdentity,
                    dialect=db.dialect,
                    unique_by=("id",),
                    on_conflict=OnConflict.DO_NOTHING,
                    constraint_name=_PK_CONSTRAINT,
                )
            )
            stored = await session.scalar(seed_stmt)
    assert isinstance(stored, (bytes, memoryview)) and len(stored) == _SEED_LENGTH
    return bytes(stored)


def derive_deployment_key(
    *,
    seed: bytes,
    secret: SecretStr,
    purpose: bytes,
    length: int = 32,
) -> bytes:
    """Derive a purpose-specific key from the deployment seed and secret.

    Args:
        seed: Deployment seed. Callers that load it pass 32 bytes.
        secret: ``PHOENIX_SECRET``, empty when unset.
        purpose: Domain-separation label.
        length: Derived key length in bytes.

    Returns:
        The derived key.
    """
    # The seed is a fixed 32 bytes, so secret bytes followed by the seed are unambiguous.
    keying_material = secret.get_secret_value().encode("utf-8") + seed
    return HKDF(
        algorithm=hashes.SHA256(),
        length=length,
        salt=_HKDF_SALT,
        info=purpose,
    ).derive(keying_material)
