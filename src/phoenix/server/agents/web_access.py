from __future__ import annotations

import re

from pydantic_ai.capabilities import WebFetch, WebSearch
from pydantic_ai.models import Model
from pydantic_ai.native_tools import WebFetchTool, WebSearchTool

from phoenix.server.agents.types import AgentDependencies

# pydantic-ai's model profiles over-report provider-native web search support:
# for OpenAI, Anthropic, and Google, `supported_native_tools` advertises
# `WebSearchTool` for *every* model in the family, regardless of whether the
# specific model actually accepts the web_search tool at request time. (OpenAI
# narrows this per-model only for the Chat Completions API; the Responses API,
# Anthropic, and Google do not narrow it at all.)
#
# We assume modern and future models support web search, so the corrections
# below are denylists rather than allowlists: each records only the families
# known *today* to lack web search. New families pass through automatically;
# these patterns only need editing if a provider ships a *new* model that lacks
# web search. An excluded model simply hides the toggle rather than offering a
# request that fails at the provider.
#
# Keyed by the model's pydantic-ai ``system`` value, which also identifies
# OpenAI-/Anthropic-/Google-compatible custom providers.

# OpenAI: `gpt-3.5*` and the base `gpt-4` family lack web search; `gpt-4o*` and
# `gpt-4.1*` (excluded via the `(?![o.])` lookahead) support it, as do the
# `o*`/`gpt-5*` families. The `text-`/`code-`/`davinci`/... entries are legacy
# completion models.
_OPENAI_NO_WEB_SEARCH_MODEL_PATTERN = re.compile(
    r"""
    ^(
        gpt-3\.5            # gpt-3.5-turbo, ...
        | gpt-4(?![o.])     # gpt-4, gpt-4-turbo, ... but not gpt-4o* / gpt-4.1*
        | (text-|code-)     # legacy completion models, e.g. text-davinci-003
        | davinci | curie | babbage | ada
    )
    """,
    re.VERBOSE,
)

# Anthropic: the web search server tool requires Claude 3.5-era models and
# later. Claude 2.x, Claude Instant, and the original Claude 3 models
# (`claude-3-opus/sonnet/haiku`, but not `claude-3-5*`/`claude-3-7*`) lack it.
# The `(?![-.]?5|[-.]?7)` lookahead keeps `claude-3-5*` and `claude-3-7*`
# (and `claude-3.5*`/`claude-3.7*`) off the denylist.
_ANTHROPIC_NO_WEB_SEARCH_MODEL_PATTERN = re.compile(
    r"""
    ^(
        claude-2                       # claude-2, claude-2.1, ...
        | claude-instant               # claude-instant-1, ...
        | claude-3(?![-.]?5|[-.]?7)    # claude-3-opus/sonnet/haiku, not 3.5/3.7
    )
    """,
    re.VERBOSE,
)

# Google: grounding with Google Search via the modern `google_search` tool
# requires Gemini 1.5-era models and later. Gemini 1.0 (`gemini-1.0*` and the
# bare `gemini-pro`/`gemini-pro-vision` 1.0 aliases) used the older
# `google_search_retrieval` config and is treated as unsupported here.
_GOOGLE_NO_WEB_SEARCH_MODEL_PATTERN = re.compile(
    r"""
    ^(
        (models/)?           # Google model names may be prefixed with `models/`
        (
            gemini-1\.0      # gemini-1.0-pro, ...
            | gemini-pro$    # bare 1.0 alias
            | gemini-pro-vision
        )
    )
    """,
    re.VERBOSE,
)

# Maps a pydantic-ai ``system`` value to the denylist of model names within
# that provider family that do NOT support provider-native web search.
_NO_WEB_SEARCH_MODEL_PATTERNS: dict[str, re.Pattern[str]] = {
    "openai": _OPENAI_NO_WEB_SEARCH_MODEL_PATTERN,
    "anthropic": _ANTHROPIC_NO_WEB_SEARCH_MODEL_PATTERN,
    "google": _GOOGLE_NO_WEB_SEARCH_MODEL_PATTERN,
}


def _model_supports_web_search(model: Model) -> bool:
    """Whether a specific model supports provider-native web search.

    Corrects pydantic-ai's profile over-reporting (see module docstring) by
    excluding the legacy families known not to support web search. Providers
    without a denylist, and any model not matched by its provider's denylist,
    are assumed to support it.
    """
    pattern = _NO_WEB_SEARCH_MODEL_PATTERNS.get(model.system)
    if pattern is None:
        return True
    return not pattern.match(model.model_name)


def build_web_search_capability(model: Model) -> WebSearch[AgentDependencies] | None:
    """Return a provider-native web search capability if the model supports it.

    The model's pydantic-ai profile must advertise web search, and the model
    must not be on the provider-specific denylist of legacy families that lack
    web search despite the profile (see module docstring).
    """
    if WebSearchTool not in model.profile.supported_native_tools:
        return None
    if not _model_supports_web_search(model):
        return None
    return WebSearch(native=True, local=False)


def build_web_fetch_capability(model: Model) -> WebFetch[AgentDependencies] | None:
    """Return a provider-native web fetch capability if the model supports it."""
    if WebFetchTool not in model.profile.supported_native_tools:
        return None
    return WebFetch(native=True, local=False)
