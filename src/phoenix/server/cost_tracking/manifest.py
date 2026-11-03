"""
Loader for the model cost manifest (``manifests/v<schema_version>.json``).

The manifest is generated from LiteLLM's price list by ``scripts/cost_tracking/sync_models.py``.
A copy ships with Phoenix, and newer copies can be fetched at runtime, so this loader is
lenient about content: unknown fields are ignored, and an entry that fails validation is
skipped with a warning instead of failing the whole manifest. Only problems with the manifest
as a whole (invalid JSON, an unsupported ``schema_version``, a bad ``generated_at``) raise.

Built-in models are identified by name and type (``LLM``, ``DECISION`` or ``EMBEDDING``), so
one name can be priced once as an LLM and once as a decision model. LLM entries go in
``models`` and every other type in ``non_llm_models``. The split is for servers released before
types existed: they fetch this same file, ignore keys they don't know, and treat every entry in
``models`` as an LLM keyed by name alone. So a typed entry in ``models`` would be priced as an
LLM by those servers, and a second entry with the same name would be dropped as a duplicate.
"""

import hashlib
import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Any, NamedTuple, Optional, Union, cast, get_args

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

from phoenix.db.models import GenerativeModelType

logger = logging.getLogger(__name__)

SUPPORTED_SCHEMA_VERSION = 1

# The schema version is in the path so that servers fetching from GitHub only ever get a
# manifest they can read, even after a newer schema ships next to it. The sync script and
# cost-sync.yml only write the current schema's file, so bumping the version freezes the old
# file, and its generated_at, for every older server. Servers apply a manifest only if its
# generated_at is newer than the last one applied, regardless of schema, so that freeze is what
# keeps replicas of different versions sharing a database from overwriting each other's prices.
# Keeping the old file synced would break it.
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


def _strip_optional(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    return value.strip() or None


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


class ManifestModelKey(NamedTuple):
    """Identifies a built-in model: names are only unique within a type."""

    name: str
    type: GenerativeModelType


class ManifestModel(_ManifestBaseModel):
    name: Annotated[str, AfterValidator(_strip_non_empty)]
    name_pattern: Annotated[re.Pattern[str], BeforeValidator(_compile_regex)]
    provider: Annotated[Optional[str], AfterValidator(_strip_optional)] = None
    source: Optional[str] = None
    type: GenerativeModelType = "LLM"
    token_prices: list[ManifestTokenPrice]

    @property
    def key(self) -> ManifestModelKey:
        return ManifestModelKey(self.name, self.type)

    @model_validator(mode="after")
    def _check_unique_token_prices(self) -> "ManifestModel":
        seen: set[tuple[str, bool]] = set()
        for token_price in self.token_prices:
            key = (token_price.token_type, token_price.is_prompt)
            if key in seen:
                raise ValueError(
                    f"duplicate token price for token_type '{key[0]}' with is_prompt={key[1]}"
                )
            seen.add(key)
        if any(is_prompt for _, is_prompt in seen) and ("input", True) not in seen:
            raise ValueError("Token prices for prompt must include an 'input' token type")
        if any(not is_prompt for _, is_prompt in seen) and ("output", False) not in seen:
            raise ValueError("Token prices for completion must include an 'output' token type")
        return self


class ModelCostManifest(_ManifestBaseModel):
    schema_version: int
    generated_at: Annotated[AwareDatetime, AfterValidator(_to_utc)]
    # The valid entries of every type: those from ``models`` and those from ``non_llm_models``.
    models: list[ManifestModel]
    # Names and types of entries that were skipped as invalid and have no valid entry. Their
    # models are not gone upstream, so applying the manifest leaves them as they are.
    skipped_models: frozenset[ManifestModelKey] = Field(default_factory=frozenset, exclude=True)


# The manifest's lists of entries, and whether each holds LLMs or every other type.
_LLM_SECTION = "models"
_NON_LLM_SECTION = "non_llm_models"
_MODEL_TYPES: frozenset[str] = frozenset(get_args(GenerativeModelType))
_NON_LLM_TYPES: frozenset[str] = _MODEL_TYPES - {"LLM"}


def parse_manifest(data: Union[bytes, str]) -> ModelCostManifest:
    """
    Parses a model cost manifest.

    Raises:
        ManifestError: If the manifest is not valid JSON, has a missing or unsupported
            ``schema_version``, or a missing or invalid ``generated_at``. Invalid model
            entries are logged and skipped instead, and their names and types are recorded
            in ``skipped_models``.
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
    raw_models = raw.get(_LLM_SECTION)
    if not isinstance(raw_models, list):
        raise ManifestError("Model cost manifest must have a list of models")
    raw_non_llm_models = raw.get(_NON_LLM_SECTION, [])
    if not isinstance(raw_non_llm_models, list):
        raise ManifestError(f"Model cost manifest's {_NON_LLM_SECTION} must be a list")

    # Validate the top level before the entries, so a rejected manifest logs nothing per entry.
    top_level = {k: v for k, v in raw.items() if k != _NON_LLM_SECTION}
    try:
        manifest = ModelCostManifest.model_validate({**top_level, "models": []})
    except ValidationError as error:
        raise ManifestError(f"Invalid model cost manifest: {_summarize(error)}") from error

    models: list[ManifestModel] = []
    seen_keys: set[ManifestModelKey] = set()
    seen_patterns: set[tuple[re.Pattern[str], Optional[str], str]] = set()
    skipped_keys: set[ManifestModelKey] = set()
    for section, section_models in (
        (_LLM_SECTION, raw_models),
        (_NON_LLM_SECTION, raw_non_llm_models),
    ):
        for index, model_data in enumerate(section_models):
            try:
                model = ManifestModel.model_validate(model_data)
            except ValidationError as error:
                label = _label(section, index, model_data)
                if (key := _raw_key(model_data)) is not None:
                    skipped_keys.add(key)
                logger.warning(
                    f"Skipping model {label} in model cost manifest: {_summarize(error)}"
                )
                continue
            if (section == _NON_LLM_SECTION) != (model.type in _NON_LLM_TYPES):
                # Servers that predate types would price a non-LLM entry in models as an LLM.
                # Treated like an invalid entry, so its model is left as it is.
                logger.warning(
                    f"Skipping model '{model.name}' in model cost manifest: type {model.type} "
                    f"is not allowed in {section}"
                )
                skipped_keys.add(model.key)
                continue
            if model.key in seen_keys:
                logger.warning(
                    f"Skipping model '{model.name}' ({model.type}) in model cost manifest: "
                    "duplicate name"
                )
                continue
            pattern_key = (model.name_pattern, model.provider, model.type)
            if pattern_key in seen_patterns:
                logger.warning(
                    f"Skipping model '{model.name}' ({model.type}) in model cost manifest: "
                    "duplicate name_pattern/provider combination"
                )
                skipped_keys.add(model.key)
                continue
            seen_keys.add(model.key)
            seen_patterns.add(pattern_key)
            models.append(model)
    skipped_keys -= seen_keys
    return manifest.model_copy(update={"models": models, "skipped_models": frozenset(skipped_keys)})


def _label(section: str, index: int, model_data: Any) -> str:
    name = model_data.get("name") if isinstance(model_data, dict) else None
    if isinstance(name, str) and name.strip():
        return f"'{name}'"
    return f"at index {index} of {section}"


def _raw_key(model_data: Any) -> Optional[ManifestModelKey]:
    """The name and type of an invalid entry, if they can be told, so its model is kept."""
    if not isinstance(model_data, dict):
        return None
    name = model_data.get("name")
    if not isinstance(name, str) or not name.strip():
        return None
    model_type = model_data.get("type", "LLM")
    if not isinstance(model_type, str) or model_type not in _MODEL_TYPES:
        return None
    # Kept even when the entry is in the wrong list, like a valid misplaced entry.
    return ManifestModelKey(name.strip(), cast(GenerativeModelType, model_type))


def compute_models_sha256(models: list[Any]) -> str:
    """
    Digest of a manifest's entries, as JSON values, recorded as its ``models_sha256``. Pass
    ``models`` followed by ``non_llm_models``, so a manifest without non-LLM entries keeps the
    digest it had before they existed.

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
