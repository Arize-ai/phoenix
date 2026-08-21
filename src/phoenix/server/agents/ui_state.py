"""The per-turn ``<phoenix_ui_state>`` block: what the user was looking at, and
what the server had enabled, at the moment one user message was written.

Everything the agent needs to know about a turn that is not fixed prose lives
here. The prose itself is static (``prompts/static/context/``) and sits in the
system prompt, inside the provider's cacheable prefix; only the data varies, and
data belongs at the tail of the message stream where a change costs one block
instead of the whole conversation.

The rule this module exists to enforce is that a turn's state is **frozen at
write time**. A snapshot is built once, from the request that produced that user
message, stored on the message, and rendered from storage forever after. Recomputing
it from the live request would rewrite the bytes of every earlier turn on every
navigation, which busts the prefix behind them — the exact cost the split was
meant to remove, and one that shows up only in cache-hit metrics because the
model's behavior stays correct throughout.
"""

from __future__ import annotations

from string import ascii_uppercase
from typing import Literal

from pydantic import ConfigDict

from phoenix.db.types.data_stream_protocol._models import CamelBaseModel
from phoenix.server.agents.context import (
    AgentSpanContext,
    CodeEvaluatorContext,
    DatasetContext,
    LlmEvaluatorContext,
    PlaygroundContext,
    ProjectContext,
    PromptContext,
    PromptVersionContext,
    ResolvedContexts,
    SessionContext,
    TraceContext,
    sanitize_untrusted_value,
)

UI_STATE_TAG = "phoenix_ui_state"

_MAX_FREE_TEXT_CHARS = 200
"""Cap for user-authored names and descriptions rendered as attributes."""

_MAX_SPAN_FILTER_CHARS = 512
"""Cap for a project's span-filter expression, which is legitimately long."""


class UIStateView(CamelBaseModel):
    """What the user was looking at: the subset of ``ResolvedContexts`` that
    describes the mounted view.

    Deliberately excludes ``app`` (the browser clock, which the
    ``get_current_datetime`` tool reads at call time), ``web_access`` and
    ``subagents`` (tool-availability requests, not view state), and ``graphql``
    (folded into ``UIStateEnvironment.graphql_mutations_enabled``).
    """

    model_config = ConfigDict(extra="ignore")

    project: ProjectContext | None = None
    trace: TraceContext | None = None
    session: SessionContext | None = None
    span: AgentSpanContext | None = None
    prompt: PromptContext | None = None
    prompt_version: PromptVersionContext | None = None
    dataset: DatasetContext | None = None
    playground: PlaygroundContext | None = None
    code_evaluator: CodeEvaluatorContext | None = None
    llm_evaluator: LlmEvaluatorContext | None = None


class UIStateEnvironment(CamelBaseModel):
    """What the server had enabled for the turn.

    ``is_viewer``, ``has_usable_sandbox``, and ``has_usable_model_provider`` are
    resolved server-side rather than sent by the client, but they still have to
    be frozen per turn: they gate which branch of the evaluator and dataset
    prose applies, so recomputing them per request would vary the rendered
    history.
    """

    model_config = ConfigDict(extra="ignore")

    edit_permission: Literal["manual", "bypass"] = "manual"
    is_viewer: bool = False
    has_usable_sandbox: bool = False
    has_usable_model_provider: bool = False
    graphql_mutations_enabled: bool = True


class UIStateSnapshot(CamelBaseModel):
    """One turn's frozen UI state, persisted on its user message.

    Both sections are always carried in full. Emitting only what changed would
    make "the most recent block is authoritative" false, forcing the model to
    merge a fresh ``<view>`` against an ``<environment>`` from many turns back.
    """

    model_config = ConfigDict(extra="ignore")

    view: UIStateView
    environment: UIStateEnvironment


def build_ui_state_snapshot(
    *,
    contexts: ResolvedContexts,
    edit_permission: Literal["manual", "bypass"],
    is_viewer: bool,
    has_usable_sandbox: bool,
    has_usable_model_provider: bool,
) -> UIStateSnapshot:
    """Freeze the current request's UI state for the user message it produced."""
    return UIStateSnapshot(
        view=UIStateView(
            project=contexts.project,
            trace=contexts.trace,
            session=contexts.session,
            span=contexts.span,
            prompt=contexts.prompt,
            prompt_version=contexts.prompt_version,
            dataset=contexts.dataset,
            playground=contexts.playground,
            code_evaluator=contexts.code_evaluator,
            llm_evaluator=contexts.llm_evaluator,
        ),
        environment=UIStateEnvironment(
            edit_permission=edit_permission,
            is_viewer=is_viewer,
            has_usable_sandbox=has_usable_sandbox,
            has_usable_model_provider=has_usable_model_provider,
            graphql_mutations_enabled=contexts.graphql_mutations_enabled,
        ),
    )


def _escape(value: str) -> str:
    """Escape the five XML metacharacters.

    Replaces the Jinja ``e`` filter. ``&`` must go first or it would re-escape
    the ampersands introduced by the later replacements.
    """
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


def _safe(value: str, *, max_chars: int = _MAX_FREE_TEXT_CHARS) -> str:
    """Render a client-supplied free-text value as XML-safe content.

    Replaces the Jinja ``sanitize | e`` filter chain: collapse to one line,
    neutralize the enclosing block's closing tag, cap the length, then escape.
    """
    return _escape(sanitize_untrusted_value(value, enclosing_tag=UI_STATE_TAG, max_chars=max_chars))


def _bool(value: bool) -> str:
    return "true" if value else "false"


def _attrs(*pairs: tuple[str, str | None]) -> str:
    """Join ``name="value"`` pairs, dropping those whose value is ``None``.

    Values are assumed already escaped by the caller, which is what keeps the
    escaping decision (free text vs. validated identifier) at the call site.
    """
    return "".join(f' {name}="{value}"' for name, value in pairs if value is not None)


def _instance_label(index: int) -> str:
    """The alphabetic label the UI shows for a playground instance.

    Past the 26th instance — which the UI does not produce — the numeric index
    stands in rather than raising.
    """
    return ascii_uppercase[index] if index < len(ascii_uppercase) else str(index + 1)


def _render_project(project: ProjectContext, indent: str) -> list[str]:
    open_tag = f"{indent}<project{_attrs(('projectNodeId', project.project_node_id))}"
    if project.span_filter is None:
        return [f"{open_tag}/>"]
    if not project.span_filter:
        return [
            open_tag + ">",
            f'{indent}  <span_filter status="available"/>',
            f"{indent}</project>",
        ]
    condition = _safe(project.span_filter, max_chars=_MAX_SPAN_FILTER_CHARS)
    return [
        open_tag + ">",
        f'{indent}  <span_filter status="applied">{condition}</span_filter>',
        f"{indent}</project>",
    ]


def _render_playground(
    playground: PlaygroundContext,
    indent: str,
) -> list[str]:
    open_attrs = _attrs(
        ("recordExperiments", _bool(playground.record_experiments)),
        ("repetitions", str(playground.repetitions)),
    )
    lines = [f"{indent}<playground{open_attrs}>"]
    inner = indent + "  "
    scaffold = playground.next_experiment_scaffold
    if scaffold is None:
        lines.append(f"{inner}<next_experiment_scaffold/>")
    else:
        lines.append(
            f"{inner}<next_experiment_scaffold"
            + _attrs(
                ("name", _safe(scaffold.name) if scaffold.name else None),
                ("description", _safe(scaffold.description) if scaffold.description else None),
                ("hasMetadata", _bool(scaffold.has_metadata)),
            )
            + "/>"
        )
    if not playground.instances:
        lines.append(f"{inner}<instances/>")
    else:
        lines.append(f"{inner}<instances>")
        for index, instance in enumerate(playground.instances):
            model = instance.model
            lines.append(
                f"{inner}  <instance"
                + _attrs(
                    ("label", _instance_label(index)),
                    ("instanceId", str(instance.instance_id)),
                    (
                        "experimentId",
                        _safe(instance.experiment_id) if instance.experiment_id else None,
                    ),
                    ("provider", _safe(model.provider) if model else None),
                    ("modelName", _safe(model.model_name) if model else None),
                    (
                        "customProviderId",
                        _safe(model.custom_provider_id)
                        if model and model.type == "custom"
                        else None,
                    ),
                    (
                        "customProviderName",
                        _safe(model.custom_provider_name)
                        if model and model.type == "custom"
                        else None,
                    ),
                )
                + "/>"
            )
        lines.append(f"{inner}</instances>")
    if not playground.evaluators:
        lines.append(f"{inner}<evaluators/>")
    else:
        lines.append(f"{inner}<evaluators>")
        for evaluator in playground.evaluators:
            lines.append(
                f"{inner}  <evaluator"
                + _attrs(
                    ("datasetEvaluatorId", _safe(evaluator.dataset_evaluator_id)),
                    ("name", _safe(evaluator.name)),
                    ("kind", evaluator.kind),
                    ("builtin", _bool(evaluator.is_builtin)),
                    ("applied", _bool(evaluator.is_applied)),
                )
                + "/>"
            )
        lines.append(f"{inner}</evaluators>")
    lines.append(f"{indent}</playground>")
    return lines


def _render_evaluator_form(
    tag: str,
    evaluator_node_id: str | None,
    indent: str,
) -> list[str]:
    return [
        f"{indent}<{tag}"
        + _attrs(
            ("mode", "edit" if evaluator_node_id else "create"),
            ("evaluatorNodeId", evaluator_node_id),
        )
        + "/>"
    ]


def _render_view(view: UIStateView, indent: str) -> list[str]:
    inner = indent + "  "
    children: list[str] = []
    if view.project is not None:
        children += _render_project(view.project, inner)
    if (trace := view.trace) is not None:
        children.append(
            f"{inner}<trace"
            + _attrs(
                ("projectNodeId", trace.project_node_id),
                ("otelTraceId", trace.otel_trace_id),
            )
            + "/>"
        )
    if (session := view.session) is not None:
        children.append(
            f"{inner}<session"
            + _attrs(
                ("projectNodeId", session.project_node_id),
                ("sessionNodeId", session.session_node_id),
            )
            + "/>"
        )
    if (span := view.span) is not None:
        children.append(
            f"{inner}<span"
            + _attrs(
                ("projectNodeId", span.project_node_id),
                ("spanNodeId", span.span_node_id),
                ("otelSpanId", span.otel_span_id),
            )
            + "/>"
        )
    if (prompt := view.prompt) is not None:
        children.append(f"{inner}<prompt" + _attrs(("promptNodeId", prompt.prompt_node_id)) + "/>")
    if (prompt_version := view.prompt_version) is not None:
        children.append(
            f"{inner}<prompt_version"
            + _attrs(
                ("promptNodeId", prompt_version.prompt_node_id),
                ("promptVersionNodeId", prompt_version.prompt_version_node_id),
            )
            + "/>"
        )
    if (dataset := view.dataset) is not None:
        children.append(
            f"{inner}<dataset"
            + _attrs(
                ("datasetNodeId", dataset.dataset_node_id),
                ("datasetVersionNodeId", dataset.dataset_version_node_id),
            )
            + "/>"
        )
    if view.playground is not None:
        children += _render_playground(view.playground, inner)
    if (code_evaluator := view.code_evaluator) is not None:
        children += _render_evaluator_form(
            "code_evaluator_form", code_evaluator.evaluator_node_id, inner
        )
    if (llm_evaluator := view.llm_evaluator) is not None:
        children += _render_evaluator_form(
            "llm_evaluator_form", llm_evaluator.evaluator_node_id, inner
        )
    if not children:
        return [f"{indent}<view/>"]
    return [f"{indent}<view>", *children, f"{indent}</view>"]


def _render_environment(environment: UIStateEnvironment, indent: str) -> str:
    return (
        f"{indent}<environment"
        + _attrs(
            ("editPermission", environment.edit_permission),
            ("isViewer", _bool(environment.is_viewer)),
            ("hasUsableSandbox", _bool(environment.has_usable_sandbox)),
            ("hasUsableModelProvider", _bool(environment.has_usable_model_provider)),
            ("graphqlMutationsEnabled", _bool(environment.graphql_mutations_enabled)),
        )
        + "/>"
    )


def render_ui_state(snapshot: UIStateSnapshot) -> str:
    """Render one frozen snapshot as its ``<phoenix_ui_state>`` block.

    Pure: the same snapshot renders to the same bytes forever, which is what
    lets a turn's block stay put in the cached prefix as the conversation grows.
    """
    return "\n".join(
        [
            f"<{UI_STATE_TAG}>",
            *_render_view(snapshot.view, "  "),
            _render_environment(snapshot.environment, "  "),
            f"</{UI_STATE_TAG}>",
        ]
    )
