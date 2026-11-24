from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models


async def get_prompt_referencing_llm_evaluator_names(
    *,
    session: AsyncSession,
    prompt_id: int,
) -> list[str]:
    """Return sorted names of LLM evaluators referencing ``prompt_id``."""
    stmt = (
        select(models.LLMEvaluator.name)
        .where(models.LLMEvaluator.prompt_id == prompt_id)
        .order_by(models.LLMEvaluator.name)
    )
    return [str(name) for name in await session.scalars(stmt)]


def format_prompt_in_use_by_llm_evaluators_message(evaluator_names: Sequence[str]) -> str:
    """Format a conflict detail string naming the referencing LLM evaluators."""
    if not evaluator_names:
        return "Cannot delete prompt because it is used by an LLM evaluator"
    if len(evaluator_names) == 1:
        return f"Cannot delete prompt because it is used by LLM evaluator '{evaluator_names[0]}'"
    joined = ", ".join(f"'{name}'" for name in evaluator_names)
    return f"Cannot delete prompt because it is used by LLM evaluators: {joined}"
