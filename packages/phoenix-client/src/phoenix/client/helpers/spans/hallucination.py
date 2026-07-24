from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional

from openinference.semconv.trace import SpanAttributes

from phoenix.client.types.spans import SpanQuery
from phoenix.client.utils.config import get_env_project_name

if TYPE_CHECKING:
    import pandas as pd

    from phoenix.client import AsyncClient, Client


LLM_INPUT_MESSAGES = SpanAttributes.LLM_INPUT_MESSAGES
LLM_OUTPUT_MESSAGES = SpanAttributes.LLM_OUTPUT_MESSAGES
INPUT_VALUE = SpanAttributes.INPUT_VALUE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE

_RENAME = {
    LLM_INPUT_MESSAGES: "input_messages",
    LLM_OUTPUT_MESSAGES: "output_messages",
    INPUT_VALUE: "input_value",
    OUTPUT_VALUE: "output_value",
}

IS_LLM = "span_kind == 'LLM'"
DEFAULT_TIMEOUT_IN_SECONDS = 5

_EVALS_IMPORT_ERROR = (
    "get_hallucination_context requires arize-phoenix-evals. "
    "Install it with `pip install 'arize-phoenix-client[evals]'`."
)


def _as_text(value: Any) -> str:
    return value if isinstance(value, str) else ""


def _response_text(messages: "list[dict[str, Any]]") -> str:
    parts = [
        m["content"]
        for m in messages
        if m.get("role") == "assistant" and isinstance(m.get("content"), str)
    ]
    return "\n".join(parts)


def _row_to_eval_input(
    input_messages: Any,
    output_messages: Any,
    input_value: Any,
    output_value: Any,
    **context_options: Any,
) -> "dict[str, str]":
    """Builds a hallucination eval input from one LLM span's message attributes.

    The span's ``input_messages`` are the conversation the model saw. The latest
    user turn is held out as ``input`` (the question being answered) and the rest
    becomes the ``conversation`` grounding. The response under judgment comes from
    the assistant ``output_messages``, falling back to ``output_value``.
    """
    try:
        from phoenix.evals.context import build_conversation_context, reconstruct_messages
    except ImportError as error:
        raise ImportError(_EVALS_IMPORT_ERROR) from error

    messages = reconstruct_messages(input_messages)
    if messages and messages[-1].get("role") == "user":
        latest = messages.pop()
        input_text = _as_text(latest.get("content")) or _as_text(input_value)
    else:
        input_text = _as_text(input_value)

    conversation = build_conversation_context(messages, **context_options)
    output_text = _response_text(reconstruct_messages(output_messages)) or _as_text(output_value)
    return {"conversation": conversation, "input": input_text, "output": output_text}


def _build_query() -> SpanQuery:
    return (
        SpanQuery()
        .select("span_id", LLM_INPUT_MESSAGES, LLM_OUTPUT_MESSAGES, INPUT_VALUE, OUTPUT_VALUE)
        .rename(**_RENAME)
        .where(IS_LLM)
        .with_index("span_id")
    )


def _assemble(df: "pd.DataFrame", context_options: "dict[str, Any]") -> "pd.DataFrame":
    import pandas as pd

    records = [
        _row_to_eval_input(
            row.get("input_messages"),
            row.get("output_messages"),
            row.get("input_value"),
            row.get("output_value"),
            **context_options,
        )
        for _, row in df.iterrows()
    ]
    return pd.DataFrame.from_records(records, index=df.index)


def get_hallucination_context(
    client: "Client",
    *,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    project_name: Optional[str] = None,
    project_identifier: Optional[str] = None,
    timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    **context_options: Any,
) -> Optional["pd.DataFrame"]:
    """Extracts conversation-grounded inputs for hallucination evaluation.

    Fetches LLM spans and, for each one, assembles the conversation the model saw
    into a bounded transcript. The result is formatted for the ``hallucination``
    evaluator in phoenix.evals.

    Requires the ``evals`` extra (``pip install 'arize-phoenix-client[evals]'``).

    Args:
        client: Phoenix Client instance.
        start_time: Optional start time for filtering spans (inclusive lower bound).
        end_time: Optional end time for filtering spans (exclusive upper bound).
        project_name: Project name (alias for project_identifier). If not provided,
            uses the environment variable PHOENIX_PROJECT_NAME.
        project_identifier: Project identifier (name or ID). Takes precedence over
            project_name if both are provided.
        timeout: Request timeout in seconds. Defaults to 5.
        **context_options: Forwarded to
            :func:`phoenix.evals.context.build_conversation_context` to control the
            assembled conversation (e.g. ``max_context_tokens``, ``include_roles``,
            ``per_message_char_limit``).

    Returns:
        Optional[pd.DataFrame]: One row per LLM span, indexed by span id, with
            columns:
            - `conversation`: The bounded transcript the model had access to
            - `input`: The latest user message the response is answering
            - `output`: The assistant response to classify
        Returns None if no LLM spans are found.

    Examples:
        Basic usage::

            from phoenix.client import Client
            from phoenix.client.helpers.spans import get_hallucination_context

            client = Client()
            df = get_hallucination_context(client, project_name="my-agent")

        With phoenix.evals::

            from phoenix.evals import LLM, evaluate_dataframe
            from phoenix.evals.metrics import HallucinationEvaluator

            llm = LLM(provider="openai", model="gpt-4o")
            df = get_hallucination_context(client, project_name="my-agent")
            if df is not None:
                results = evaluate_dataframe(
                    dataframe=df,
                    evaluators=[HallucinationEvaluator(llm=llm)],
                )
    """
    project = project_identifier or project_name or get_env_project_name()
    df = client.spans.get_spans_dataframe(
        query=_build_query(),
        start_time=start_time,
        end_time=end_time,
        project_name=project,
        timeout=timeout,
    )
    if df is None or df.empty:
        print("No LLM spans found.")
        return None
    return _assemble(df, context_options)


async def async_get_hallucination_context(
    client: "AsyncClient",
    *,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    project_name: Optional[str] = None,
    project_identifier: Optional[str] = None,
    timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    **context_options: Any,
) -> Optional["pd.DataFrame"]:
    """Async version of get_hallucination_context.

    Requires the ``evals`` extra (``pip install 'arize-phoenix-client[evals]'``).

    Args:
        client: Phoenix AsyncClient instance.
        start_time: Optional start time for filtering spans (inclusive lower bound).
        end_time: Optional end time for filtering spans (exclusive upper bound).
        project_name: Project name (alias for project_identifier). If not provided,
            uses the environment variable PHOENIX_PROJECT_NAME.
        project_identifier: Project identifier (name or ID). Takes precedence over
            project_name if both are provided.
        timeout: Request timeout in seconds. Defaults to 5.
        **context_options: Forwarded to
            :func:`phoenix.evals.context.build_conversation_context`.

    Returns:
        Optional[pd.DataFrame]: One row per LLM span (see get_hallucination_context),
            or None if no LLM spans are found.
    """
    project = project_identifier or project_name or get_env_project_name()
    df = await client.spans.get_spans_dataframe(
        query=_build_query(),
        start_time=start_time,
        end_time=end_time,
        project_name=project,
        timeout=timeout,
    )
    if df is None or df.empty:
        print("No LLM spans found.")
        return None
    return _assemble(df, context_options)
