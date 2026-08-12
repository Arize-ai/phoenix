"""Resolve project evaluator criteria into fingerprint inputs.

``derivation`` owns the pure fingerprint recipe and explicitly cedes version resolution
and DB access to its callers; this module is that caller. Both materializers (the span
producer and the session sweeper) and the consumer's staleness guard resolve through
here, so the fingerprint they compute is the same one by construction.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any, Optional, Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.helpers import latest_code_evaluator_versions_by_evaluator_id
from phoenix.server.api.evaluators import get_builtin_evaluator_by_key
from phoenix.server.online_eval.derivation import ResolvedCriteria
from phoenix.server.online_eval.session_policy import SessionTranscriptPolicy

_SANDBOX_RUNTIME_POLICY_VERSION = "1"


async def resolve_criteria(
    session: AsyncSession,
    criteria: models.ProjectEvaluatorCriteria,
    evaluator: models.Evaluator,
) -> Optional[ResolvedCriteria]:
    """Resolve one criteria row through the shared bulk-resolution path."""
    return (await resolve_criteria_bulk(session, [(criteria, evaluator)]))[0]


async def resolve_criteria_bulk(
    session: AsyncSession,
    criteria_evaluators: Sequence[tuple[models.ProjectEvaluatorCriteria, models.Evaluator]],
) -> list[Optional[ResolvedCriteria]]:
    """Resolve criteria fingerprint inputs in bulk, pinning mutable pointers to
    immutable version identities: the tagged (or latest) PromptVersion id for LLM
    evaluators, the latest CodeEvaluatorVersion id for CODE, and
    (key, synced_at, implementation_version) for BUILTIN. Each unresolved row
    produces None.

    The consumer's staleness guard must recompute fingerprints through this same
    function — an independent resolution recipe re-materializes the backlog.
    """
    tagged_llm_evaluators: dict[int, models.LLMEvaluator] = {}
    latest_llm_evaluators: dict[int, models.LLMEvaluator] = {}
    code_evaluators: dict[int, models.CodeEvaluator] = {}
    for _, evaluator in criteria_evaluators:
        if isinstance(evaluator, models.LLMEvaluator):
            if evaluator.prompt_version_tag_id is not None:
                tagged_llm_evaluators[evaluator.id] = evaluator
            else:
                latest_llm_evaluators[evaluator.id] = evaluator
        elif isinstance(evaluator, models.CodeEvaluator):
            code_evaluators[evaluator.id] = evaluator

    tagged_prompt_version_ids: dict[int, int] = {}
    prompt_version_tag_ids = {
        evaluator.prompt_version_tag_id
        for evaluator in tagged_llm_evaluators.values()
        if evaluator.prompt_version_tag_id is not None
    }
    if prompt_version_tag_ids:
        tagged_prompt_version_ids = dict(
            (
                await session.execute(
                    select(
                        models.PromptVersionTag.id,
                        models.PromptVersionTag.prompt_version_id,
                    ).where(models.PromptVersionTag.id.in_(prompt_version_tag_ids))
                )
            )
            .tuples()
            .all()
        )

    latest_prompt_version_ids: dict[int, int] = {}
    prompt_ids = {evaluator.prompt_id for evaluator in latest_llm_evaluators.values()}
    if prompt_ids:
        latest_prompt_version_ids = dict(
            (
                await session.execute(
                    select(
                        models.PromptVersion.prompt_id,
                        func.max(models.PromptVersion.id),
                    )
                    .where(models.PromptVersion.prompt_id.in_(prompt_ids))
                    .group_by(models.PromptVersion.prompt_id)
                )
            )
            .tuples()
            .all()
        )

    # A prompt version's custom provider is a mutable pointer: editing the provider's
    # connection config changes what answers the evaluation without changing the prompt
    # version. Resolve it to (provider id, updated_at) so the fingerprint moves with it.
    custom_provider_refs: dict[int, tuple[int, str]] = {}
    prompt_version_ids = set(tagged_prompt_version_ids.values()) | set(
        latest_prompt_version_ids.values()
    )
    if prompt_version_ids:
        custom_provider_refs = {
            prompt_version_id: (custom_provider_id, updated_at.isoformat())
            for prompt_version_id, custom_provider_id, updated_at in (
                (
                    await session.execute(
                        select(
                            models.PromptVersion.id,
                            models.GenerativeModelCustomProvider.id,
                            models.GenerativeModelCustomProvider.updated_at,
                        )
                        .join(
                            models.GenerativeModelCustomProvider,
                            models.PromptVersion.custom_provider_id
                            == models.GenerativeModelCustomProvider.id,
                        )
                        .where(models.PromptVersion.id.in_(prompt_version_ids))
                    )
                )
                .tuples()
                .all()
            )
        }

    latest_code_versions = await latest_code_evaluator_versions_by_evaluator_id(
        list(code_evaluators),
        session,
    )
    sandbox_runtime_fingerprints: dict[int, str] = {}
    sandbox_config_ids = {
        evaluator.sandbox_config_id
        for evaluator in code_evaluators.values()
        if evaluator.sandbox_config_id is not None
    }
    if sandbox_config_ids:
        sandbox_rows = (
            await session.execute(
                select(models.SandboxConfig, models.SandboxProvider)
                .join(
                    models.SandboxProvider,
                    models.SandboxProvider.backend_type == models.SandboxConfig.backend_type,
                )
                .where(models.SandboxConfig.id.in_(sandbox_config_ids))
            )
        ).all()
        sandbox_runtime_fingerprints = {
            sandbox_config.id: _sandbox_runtime_fingerprint(sandbox_config, provider)
            for sandbox_config, provider in sandbox_rows
            if sandbox_config.enabled and provider.enabled
        }

    resolved: list[Optional[ResolvedCriteria]] = []
    for criteria, evaluator in criteria_evaluators:
        version_ref: Any
        if isinstance(evaluator, models.LLMEvaluator):
            if evaluator.prompt_version_tag_id is not None:
                version_ref = tagged_prompt_version_ids.get(evaluator.prompt_version_tag_id)
            else:
                version_ref = latest_prompt_version_ids.get(evaluator.prompt_id)
            if (custom_provider_ref := custom_provider_refs.get(version_ref)) is not None:
                version_ref = [version_ref, *custom_provider_ref]
        elif isinstance(evaluator, models.CodeEvaluator):
            version = latest_code_versions.get(evaluator.id)
            runtime_fingerprint = (
                sandbox_runtime_fingerprints.get(evaluator.sandbox_config_id)
                if evaluator.sandbox_config_id is not None
                else None
            )
            version_ref = (
                [version.id, runtime_fingerprint]
                if version is not None and runtime_fingerprint is not None
                else None
            )
        elif isinstance(evaluator, models.BuiltinEvaluator):
            evaluator_class = get_builtin_evaluator_by_key(evaluator.key)
            if evaluator_class is None:
                resolved.append(None)
                continue
            version_ref = [
                evaluator.key,
                evaluator.synced_at.isoformat(),
                evaluator_class.implementation_version,
            ]
        else:
            resolved.append(None)
            continue
        resolved.append(_resolved_criteria(criteria, evaluator, version_ref))
    return resolved


def _sandbox_runtime_fingerprint(
    sandbox_config: models.SandboxConfig,
    provider: models.SandboxProvider,
) -> str:
    payload = {
        "policy_version": _SANDBOX_RUNTIME_POLICY_VERSION,
        "backend_type": sandbox_config.backend_type,
        "language": sandbox_config.language,
        "config": sandbox_config.config,
        "timeout": sandbox_config.timeout,
        "config_updated_at": sandbox_config.updated_at.isoformat(),
        "provider_config": provider.config,
        "provider_updated_at": provider.updated_at.isoformat(),
    }
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _resolved_criteria(
    criteria: models.ProjectEvaluatorCriteria,
    evaluator: models.LLMEvaluator | models.CodeEvaluator | models.BuiltinEvaluator,
    version_ref: Any,
) -> Optional[ResolvedCriteria]:
    input_mapping: Any = None
    sandbox_config_id: Optional[int] = None
    if isinstance(evaluator, models.CodeEvaluator):
        sandbox_config_id = evaluator.sandbox_config_id
    if version_ref is None:
        return None
    effective_input_mapping = criteria.input_mapping
    if effective_input_mapping is None and isinstance(evaluator, models.CodeEvaluator):
        effective_input_mapping = evaluator.input_mapping
    if effective_input_mapping is not None:
        input_mapping = effective_input_mapping.model_dump()
    return ResolvedCriteria(
        criteria_id=criteria.id,
        name=criteria.name.root,
        evaluator_id=evaluator.id,
        version_ref=version_ref,
        output_configs=[config.model_dump() for config in evaluator.output_configs],
        input_mapping=input_mapping,
        evaluation_target=criteria.evaluation_target,
        sandbox_config_id=sandbox_config_id,
        filter_condition=criteria.filter_condition,
        sampling_rate=criteria.sampling_rate,
        transcript_policy_fingerprint=(
            SessionTranscriptPolicy.from_env().fingerprint
            if criteria.evaluation_target == "SESSION"
            else None
        ),
    )
