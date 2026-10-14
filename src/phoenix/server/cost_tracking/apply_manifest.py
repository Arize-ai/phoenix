"""
Syncs the built-in generative models and their token prices with a model cost manifest.

The manifest bundled with Phoenix is applied at boot, and newer copies fetched at runtime are
applied the same way. The ``cost_tracking.model_cost_manifest`` system setting records which
manifest was applied last, and a manifest is only applied if it is newer, so that a boot never
rolls back prices fetched since. The rows themselves are the cache: nothing else is stored.
"""

import logging
import re
from datetime import datetime, timezone
from typing import NamedTuple, Optional

import sqlalchemy as sa
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import insert_on_conflict
from phoenix.db.models import SystemSettingKey
from phoenix.db.types.token_price_customization import TokenPriceCustomizationParser
from phoenix.server.cost_tracking.manifest import ManifestModel, ModelCostManifest
from phoenix.server.settings.registry import ManifestSource, ModelCostManifestVersionSetting

logger = logging.getLogger(__name__)

MANIFEST_VERSION_SETTING_KEY: SystemSettingKey = "cost_tracking.model_cost_manifest"

# Serializes applies across replicas sharing a PostgreSQL database. SQLite allows one writer.
_APPLY_LOCK_ID = 0x70686F656E6978  # "phoenix"


class _TokenTypeKey(NamedTuple):
    """
    Token prices are identified by their type and whether they price prompt or completion
    tokens, since some types (such as "audio") can be both.
    """

    token_type: str
    is_prompt: bool


async def get_applied_manifest_version(
    session: AsyncSession,
) -> Optional[ModelCostManifestVersionSetting]:
    value = await session.scalar(
        select(models.SystemSetting.value).where(
            models.SystemSetting.key == MANIFEST_VERSION_SETTING_KEY
        )
    )
    if value is None:
        return None
    try:
        return ModelCostManifestVersionSetting.model_validate(value)
    except ValidationError as error:
        logger.warning(f"Ignoring invalid model cost manifest version marker: {error}")
        return None


def _is_newer(
    manifest: ModelCostManifest,
    applied: Optional[ModelCostManifestVersionSetting],
) -> bool:
    if applied is None:
        return True
    # A manifest of a newer schema carries data the applied one can't, so it wins even if
    # it is older; the next fetch brings back any newer prices. One of an older schema never
    # wins, or replicas of different versions would keep overwriting each other mid-upgrade.
    if applied.schema_version != manifest.schema_version:
        return applied.schema_version < manifest.schema_version
    return manifest.generated_at > applied.generated_at


async def apply_manifest_if_newer(
    session: AsyncSession,
    manifest: ModelCostManifest,
    *,
    dialect: SupportedSQLDialect,
    source: ManifestSource,
    url: Optional[str] = None,
) -> bool:
    """
    Applies the manifest if it is newer than the one last applied, and records it as applied.

    Creates and updates built-in models and their token prices to match the manifest, and
    soft-deletes built-in models that are no longer in it unless span costs reference them
    (or a model in the manifest takes over their name_pattern and provider). Models whose
    entries were skipped as invalid are left as they are.
    Everything happens in the given session's transaction.

    Returns:
        Whether the manifest was applied.
    """
    if dialect is SupportedSQLDialect.POSTGRESQL:
        # Held until the transaction ends, so a replica applying concurrently waits here and
        # then sees the marker this one wrote.
        await session.execute(select(sa.func.pg_advisory_xact_lock(_APPLY_LOCK_ID)))
    applied = await get_applied_manifest_version(session)
    if not _is_newer(manifest, applied):
        if applied is not None and applied.schema_version > manifest.schema_version:
            logger.warning(
                f"The database has a model cost manifest of schema {applied.schema_version}, "
                f"newer than this Phoenix supports, so built-in model prices won't update "
                f"until Phoenix is upgraded"
            )
        return False

    entries = _dedupe_entries(manifest)
    built_in_models = await _get_built_in_models(session)
    incoming_patterns = {
        (manifest_model.name_pattern, _provider(manifest_model))
        for manifest_model in entries.values()
    }
    # A model that was renamed upstream keeps its name_pattern and provider, so its old row
    # must go before the new one is inserted, or the two collide on the unique index. It goes
    # even if span costs reference it; they keep pointing at the old row. Any other model
    # missing from the manifest goes only if nothing references it, and one whose entry was
    # skipped as invalid stays as it is.
    colliding: list[int] = []
    unmatched: list[int] = []
    for name, model in built_in_models.items():
        if name in entries:
            continue
        if (model.name_pattern, model.provider) in incoming_patterns:
            colliding.append(model.id)
        elif name not in manifest.skipped_model_names:
            unmatched.append(model.id)
    num_removed = await _soft_delete_models(session, colliding)
    num_removed += await _soft_delete_models(session, unmatched, unless_referenced=True)
    num_added, num_updated = await _upsert_models(session, entries, built_in_models)

    marker = ModelCostManifestVersionSetting(
        schema_version=manifest.schema_version,
        generated_at=manifest.generated_at,
        source=source,
        url=url,
        applied_at=datetime.now(timezone.utc),
    )
    payload = marker.model_dump(mode="json")
    await session.execute(
        insert_on_conflict(
            {"key": MANIFEST_VERSION_SETTING_KEY, "value": payload},
            table=models.SystemSetting,
            dialect=dialect,
            unique_by=("key",),
            constraint_name="pk_system_settings",
            set_={"value": payload, "updated_at": sa.func.now()},
        )
    )
    logger.info(
        f"Applied {source} model cost manifest generated at "
        f"{manifest.generated_at.isoformat()}: {num_added} models added, "
        f"{num_updated} updated, {num_removed} removed"
    )
    return True


def _dedupe_entries(manifest: ModelCostManifest) -> dict[str, ManifestModel]:
    """Maps names to entries, skipping entries whose name or pattern and provider repeat."""
    entries: dict[str, ManifestModel] = {}
    seen_patterns: set[tuple[re.Pattern[str], str]] = set()
    for manifest_model in manifest.models:
        name = manifest_model.name
        if name in entries:
            logger.warning(f"Skipping model '{name}' with duplicate name in manifest")
            continue
        key = (manifest_model.name_pattern, _provider(manifest_model))
        if key in seen_patterns:
            logger.warning(
                f"Skipping model '{name}' with duplicate name_pattern/provider combination"
            )
            continue
        seen_patterns.add(key)
        entries[name] = manifest_model
    return entries


def _provider(manifest_model: ManifestModel) -> str:
    return (manifest_model.provider or "").strip()


async def _upsert_models(
    session: AsyncSession,
    entries: dict[str, ManifestModel],
    built_in_models: dict[str, models.GenerativeModel],
) -> tuple[int, int]:
    """Returns the number of models added and the number of existing models changed."""
    num_added = num_updated = 0
    for name, manifest_model in entries.items():
        pattern = manifest_model.name_pattern
        provider = _provider(manifest_model)
        model = built_in_models.get(name)
        is_existing_model = model is not None
        if model is None:
            model = models.GenerativeModel(
                name=name,
                provider=provider,
                name_pattern=pattern,
                is_built_in=True,
            )
            session.add(model)
            num_added += 1
            changed = False
        else:
            changed = model.provider != provider or model.name_pattern != pattern
            model.provider = provider
            model.name_pattern = pattern

        # Prices left in this dict at the end are no longer in the manifest.
        existing_token_prices = {
            _TokenTypeKey(token_price.token_type, token_price.is_prompt): token_price
            for token_price in model.token_prices
        }
        token_prices_changed = False
        for manifest_token_price in manifest_model.token_prices:
            if not (base_rate := manifest_token_price.base_rate):
                continue
            customization = TokenPriceCustomizationParser.parse(manifest_token_price.customization)
            key = _TokenTypeKey(manifest_token_price.token_type, manifest_token_price.is_prompt)
            if not (token_price := existing_token_prices.pop(key, None)):
                model.token_prices.append(
                    models.TokenPrice(
                        token_type=key.token_type,
                        is_prompt=key.is_prompt,
                        base_rate=base_rate,
                        customization=customization,
                    )
                )
                token_prices_changed = True
                continue
            if token_price.base_rate != base_rate:
                token_price.base_rate = base_rate
                token_prices_changed = True
            if token_price.customization != customization:
                token_price.customization = customization
                token_prices_changed = True
        for token_price in existing_token_prices.values():
            model.token_prices.remove(token_price)
            token_prices_changed = True

        if is_existing_model and token_prices_changed:
            # Changing only token prices doesn't touch the model row, but the
            # GenerativeModelStore polls on the model's updated_at.
            model.updated_at = datetime.now(timezone.utc)
        if is_existing_model and (changed or token_prices_changed):
            num_updated += 1

    await session.flush()
    return num_added, num_updated


async def _soft_delete_models(
    session: AsyncSession,
    ids: list[int],
    *,
    unless_referenced: bool = False,
) -> int:
    """Soft-deletes the given models, except those that span costs reference if asked to."""
    if not ids:
        return 0
    stmt = (
        sa.update(models.GenerativeModel)
        .values(deleted_at=sa.func.now())
        .where(models.GenerativeModel.id.in_(ids))
        .execution_options(synchronize_session=False)
    )
    if unless_referenced:
        stmt = stmt.where(~sa.exists().where(models.GenerativeModel.id == models.SpanCost.model_id))
    result = await session.execute(stmt)
    return int(result.rowcount or 0)  # type: ignore[attr-defined]


async def _get_built_in_models(session: AsyncSession) -> dict[str, models.GenerativeModel]:
    return {
        model.name: model
        for model in (
            await session.scalars(
                select(models.GenerativeModel)
                .where(models.GenerativeModel.deleted_at.is_(None))
                .where(models.GenerativeModel.is_built_in.is_(True))
                .options(joinedload(models.GenerativeModel.token_prices))
            )
        ).unique()
    }
