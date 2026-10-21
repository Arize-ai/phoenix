"""
Loader for the model cost manifest (``manifests/v<schema_version>.json``).

The manifest is generated from LiteLLM's price list by ``scripts/cost_tracking/sync_models.py``.
A copy ships with Phoenix, and newer copies can be fetched at runtime, so this loader is
lenient about content: unknown fields are ignored, and an entry that fails validation is
skipped with a warning instead of failing the whole manifest. Only problems with the manifest
as a whole (invalid JSON, an unsupported ``schema_version``, a bad ``generated_at``) raise.
"""

import hashlib
import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Any, Optional, Union

from pydantic import (
    AfterValidator,
    AwareDatetime,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    ValidationError,
    model_validator,
)

logger = logging.getLogger(__name__)

SUPPORTED_SCHEMA_VERSION = 1

# The schema version is in the path so that servers fetching from GitHub only ever get a
# manifest they can read, even after a newer schema ships next to it. But the sync script and
# cost-sync.yml only write the current schema's file, so bumping the version freezes the prices
# that every older server fetches unless the old file keeps being synced too.
BUNDLED_MANIFEST_PATH = Path(__file__).parent / "manifests" / f"v{SUPPORTED_SCHEMA_VERSION}.json"
DEFAULT_MANIFEST_URL = (
    "https://raw.githubusercontent.com/Arize-ai/phoenix/main/"
    f"src/phoenix/server/cost_tracking/manifests/v{SUPPORTED_SCHEMA_VERSION}.json"
)


class ManifestError(ValueError):
    """Raised when a model cost manifest can't be used at all."""


def _to_utc(value: datetime) -> datetime:
    return value.astimezone(timezone.utc)


def _strip_non_empty(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("must not be empty")
    return value


def _compile_regex(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    try:
        return re.compile(value.strip())
    except re.error as error:
        raise ValueError(f"invalid regex: {error}")


class _ManifestBaseModel(BaseModel):
    # Ignore unknown fields so that new optional fields don't need a schema version bump.
    model_config = ConfigDict(extra="ignore", frozen=True)


class ManifestTokenPrice(_ManifestBaseModel):
    token_type: str
    is_prompt: bool
    base_rate: float = Field(ge=0)
    # Left raw; it is parsed with TokenPriceCustomizationParser when applied.
    customization: Optional[dict[str, Any]] = None


class ManifestModel(_ManifestBaseModel):
    name: Annotated[str, AfterValidator(_strip_non_empty)]
    name_pattern: Annotated[re.Pattern[str], BeforeValidator(_compile_regex)]
    provider: Optional[str] = None
    source: Optional[str] = None
    token_prices: list[ManifestTokenPrice]

    @model_validator(mode="after")
    def _check_unique_token_prices(self) -> "ManifestModel":
        # Two prices for the same token type and direction would violate the database's unique
        # constraint and roll back the whole apply. Zero prices are not stored, so they can't
        # collide.
        seen: set[tuple[str, bool]] = set()
        for token_price in self.token_prices:
            if not token_price.base_rate:
                continue
            key = (token_price.token_type, token_price.is_prompt)
            if key in seen:
                raise ValueError(
                    f"duplicate token price for token_type '{key[0]}' with is_prompt={key[1]}"
                )
            seen.add(key)
        return self


class ModelCostManifest(_ManifestBaseModel):
    schema_version: int
    generated_at: Annotated[AwareDatetime, AfterValidator(_to_utc)]
    models: list[ManifestModel]
    # Names of entries that were skipped as invalid and have no valid entry. Their models
    # are not gone upstream, so applying the manifest leaves them as they are.
    skipped_model_names: frozenset[str] = Field(default_factory=frozenset, exclude=True)


def parse_manifest(data: Union[bytes, str]) -> ModelCostManifest:
    """
    Parses a model cost manifest.

    Raises:
        ManifestError: If the manifest is not valid JSON, has a missing or unsupported
            ``schema_version``, or a missing or invalid ``generated_at``. Invalid model
            entries are logged and skipped instead, and their names are recorded in
            ``skipped_model_names``.
    """
    try:
        raw = json.loads(data)
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise ManifestError(f"Model cost manifest is not valid JSON: {error}") from error
    if not isinstance(raw, dict):
        raise ManifestError("Model cost manifest must be a JSON object")

    schema_version = raw.get("schema_version")
    if schema_version is None:
        raise ManifestError("Model cost manifest is missing schema_version")
    if (
        not isinstance(schema_version, int)
        or isinstance(schema_version, bool)
        or schema_version != SUPPORTED_SCHEMA_VERSION
    ):
        raise ManifestError(
            f"Unsupported model cost manifest schema_version {schema_version!r} "
            f"(supported: {SUPPORTED_SCHEMA_VERSION})"
        )
    if "generated_at" not in raw:
        raise ManifestError("Model cost manifest is missing generated_at")
    raw_models = raw.get("models")
    if not isinstance(raw_models, list):
        raise ManifestError("Model cost manifest must have a list of models")

    # Validate the top level before the entries, so a rejected manifest logs nothing per entry.
    try:
        manifest = ModelCostManifest.model_validate({**raw, "models": []})
    except ValidationError as error:
        raise ManifestError(f"Invalid model cost manifest: {_summarize(error)}") from error

    models: list[ManifestModel] = []
    skipped_names: set[str] = set()
    for index, model_data in enumerate(raw_models):
        try:
            models.append(ManifestModel.model_validate(model_data))
        except ValidationError as error:
            name = model_data.get("name") if isinstance(model_data, dict) else None
            if isinstance(name, str) and name.strip():
                label = f"'{name}'"
                skipped_names.add(name.strip())
            else:
                label = f"at index {index}"
            logger.warning(f"Skipping model {label} in model cost manifest: {_summarize(error)}")
    skipped_names -= {model.name for model in models}
    return manifest.model_copy(
        update={"models": models, "skipped_model_names": frozenset(skipped_names)}
    )


def compute_models_sha256(models: list[Any]) -> str:
    """
    Digest of a manifest's ``models``, as JSON values, recorded as its ``models_sha256``.

    Servers apply a manifest only if its ``generated_at`` is newer than the one they have, so
    the models must not change without it. The sync script records this digest whenever it
    sets ``generated_at``, which lets a test catch models edited by hand without the script.
    """
    canonical = json.dumps(models, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def _summarize(error: ValidationError) -> str:
    return "; ".join(
        f"{'.'.join(map(str, e['loc'])) or 'value'}: {e['msg']}" for e in error.errors()
    )
