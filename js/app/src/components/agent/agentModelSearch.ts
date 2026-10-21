/**
 * Pure search and catalog logic for the PXI chat model picker: a flat catalog
 * of every model PXI can run, token search with ranking (where a provider name
 * in the query filters to that provider), provider guessing for typed names,
 * and the provider list offered for a typed custom model name.
 *
 * Everything here works from the data `useModelMenuData` returns and from
 * server-side credentials only: PXI sends through the server proxy, so
 * browser-local keys never make a provider usable.
 */
import type {
  CustomProviderRef,
  ModelMenuValue,
} from "@phoenix/components/generative/ModelMenu";
import {
  getProviderKeyForGenerativeModelSDK,
  providerRequiresCredentials,
  providerSupportsDefaultCredentialChain,
  type ProviderCredentialStatus,
} from "@phoenix/components/generative/modelProviderUtils";
import type {
  CustomProviderInfo,
  GenerativeProviderKey,
} from "@phoenix/components/generative/useModelMenuData";
import { awsBedrockModelPrefixes } from "@phoenix/store/preferencesStore";
import {
  getProviderName,
  isModelProvider,
} from "@phoenix/utils/generativeUtils";

import {
  getAgentCuratedModelDisplayName,
  isAgentCuratedModelSelection,
} from "./agentCuratedModels";
import { getAgentModelKey, getAgentModelKeyForValue } from "./agentModelConfig";

/**
 * Whether PXI can authenticate with a provider:
 * - "ready": credentials are set on the server, or none are needed
 * - "may-work": none are set, but the provider can fall back to an ambient
 *   default credential chain the server can't detect (AWS, Azure)
 * - "no-key": credentials are required and missing
 */
export type AgentModelCredentialState = "ready" | "may-work" | "no-key";

/** A provider models can be picked from: a built-in one or a custom one. */
export type AgentModelProviderOption = {
  /** Stable id: the provider key, or `custom:<id>` for a custom provider */
  key: string;
  /** Built-in provider key; for a custom provider, the key of its SDK */
  provider: GenerativeProviderKey;
  customProvider: CustomProviderRef | null;
  /** Human-readable provider name */
  name: string;
  credentialState: AgentModelCredentialState;
};

/** One pickable model in the flat catalog. */
export type AgentModelCatalogRow = {
  /** Stable id, see `getAgentModelKey` in `agentModelConfig` */
  key: string;
  provider: GenerativeProviderKey;
  customProvider: CustomProviderRef | null;
  /** Human-readable provider name */
  providerName: string;
  modelName: string;
  isCurated: boolean;
  /** Curated display name, or null to show the raw id */
  displayName: string | null;
  credentialState: AgentModelCredentialState;
  /**
   * Set on a resolved selection whose custom provider no longer exists, see
   * {@link resolveAgentModelRow}. Catalog rows never set it.
   */
  isProviderMissing?: boolean;
};

/** A typed name to offer as a custom model, with the providers it can use. */
export type AgentModelCustomModelOption = {
  modelName: string;
  /**
   * The providers to offer, in order: the one guessed from the name, then
   * ready, may-work and no-key providers (otherwise in provider order)
   */
  providers: AgentModelProviderOption[];
  /** Key of the provider guessed from the name, when it's offered */
  guessedProviderKey: string | null;
};

export const DEFAULT_AGENT_MODEL_RESULT_LIMIT = 8;

/** The data `useModelMenuData` returns that the catalog is built from. */
export type AgentModelCatalogInput = {
  playgroundModels: readonly {
    readonly name: string;
    readonly providerKey: GenerativeProviderKey;
  }[];
  modelProviders: readonly (ProviderCredentialStatus & {
    readonly key: GenerativeProviderKey;
    readonly name: string;
  })[];
  customProviders: readonly CustomProviderInfo[];
};

/** The picker value to emit when a catalog row is picked. */
export function toAgentModelMenuValue(
  row: Pick<AgentModelCatalogRow, "provider" | "customProvider" | "modelName">
): ModelMenuValue {
  return {
    provider: row.provider,
    modelName: row.modelName,
    ...(row.customProvider && { customProvider: row.customProvider }),
  };
}

/**
 * A built-in provider's credential state from server-side status only.
 */
export function getProviderCredentialState(
  provider: Pick<ProviderCredentialStatus, "key" | "credentialsSet">
): AgentModelCredentialState {
  if (
    provider.credentialsSet ||
    !providerRequiresCredentials({ providerKey: provider.key })
  ) {
    return "ready";
  }
  if (providerSupportsDefaultCredentialChain({ providerKey: provider.key })) {
    return "may-work";
  }
  return "no-key";
}

/**
 * Every provider PXI can pick from: built-in providers with their server
 * dependencies installed (in server order), then custom providers.
 *
 * Custom providers are always "ready": their credentials live in the
 * provider's own server-side config, which Settings requires when the
 * provider is created, so the built-in provider's env-var status says nothing
 * about them. As in `ModelMenu`, they aren't filtered by dependencies.
 */
export function buildAgentModelProviderOptions({
  modelProviders,
  customProviders,
}: Pick<
  AgentModelCatalogInput,
  "modelProviders" | "customProviders"
>): AgentModelProviderOption[] {
  const builtIn = modelProviders
    .filter((provider) => provider.dependenciesInstalled)
    .map(
      (provider): AgentModelProviderOption => ({
        key: provider.key,
        provider: provider.key,
        customProvider: null,
        name: provider.name,
        credentialState: getProviderCredentialState(provider),
      })
    );
  const custom = customProviders.map(
    (customProvider): AgentModelProviderOption => ({
      key: `custom:${customProvider.id}`,
      provider: getProviderKeyForGenerativeModelSDK(customProvider.sdk),
      customProvider: { id: customProvider.id, name: customProvider.name },
      name: customProvider.name,
      credentialState: "ready",
    })
  );
  return [...builtIn, ...custom];
}

/**
 * The flat model catalog: built-in playground models for providers with
 * dependencies installed, then each custom provider's model names. Rows keep
 * the server's order; ranking happens in {@link rankAgentModels}.
 */
export function buildAgentModelCatalog({
  playgroundModels,
  modelProviders,
  customProviders,
}: AgentModelCatalogInput): AgentModelCatalogRow[] {
  const providerOptions = buildAgentModelProviderOptions({
    modelProviders,
    customProviders,
  });
  const builtInOptionsByKey = new Map(
    providerOptions
      .filter((option) => option.customProvider == null)
      .map((option) => [option.provider, option])
  );
  const builtInRows = playgroundModels.flatMap(
    (model): AgentModelCatalogRow[] => {
      const option = builtInOptionsByKey.get(model.providerKey);
      if (!option) {
        return [];
      }
      const value: ModelMenuValue = {
        provider: model.providerKey,
        modelName: model.name,
      };
      return [
        {
          key: getAgentModelKeyForValue(value),
          provider: model.providerKey,
          customProvider: null,
          providerName: option.name,
          modelName: model.name,
          isCurated: isAgentCuratedModelSelection(value),
          displayName: getAgentCuratedModelDisplayName(value),
          credentialState: option.credentialState,
        },
      ];
    }
  );
  const customRows = providerOptions.flatMap((option) => {
    const customProvider = option.customProvider;
    if (!customProvider) {
      return [];
    }
    const modelNames =
      customProviders.find((provider) => provider.id === customProvider.id)
        ?.modelNames ?? [];
    return modelNames.map(
      (modelName): AgentModelCatalogRow => ({
        key: getAgentModelKey({
          provider: option.provider,
          customProviderId: customProvider.id,
          modelName,
        }),
        provider: option.provider,
        customProvider,
        providerName: option.name,
        modelName,
        isCurated: false,
        displayName: null,
        credentialState: option.credentialState,
      })
    );
  });
  return [...builtInRows, ...customRows];
}

/**
 * The row to show for a model selection that may not be in the catalog: the
 * current model, or a recent pick such as a typed name or a Bedrock id with
 * the region prefix applied. A catalog row is returned as is. Otherwise the
 * row is built from the selection and its provider option:
 * - a custom provider that's gone (`resolvePersistedAgentModel` names it
 *   "Deleted provider") keeps the selection's provider name, and is
 *   "no-key" with `isProviderMissing` set
 * - a built-in provider that isn't installed is "no-key" too
 *
 * @param params - inputs
 * @param params.model - the selection to show
 * @param params.rows - the catalog from {@link buildAgentModelCatalog}
 * @param params.providers - from {@link buildAgentModelProviderOptions}
 */
export function resolveAgentModelRow({
  model,
  rows,
  providers,
}: {
  model: ModelMenuValue;
  rows: readonly AgentModelCatalogRow[];
  providers: readonly AgentModelProviderOption[];
}): AgentModelCatalogRow {
  const key = getAgentModelKeyForValue(model);
  const catalogRow = rows.find((row) => row.key === key);
  if (catalogRow) {
    return catalogRow;
  }
  const customProvider = model.customProvider ?? null;
  const providerOption = providers.find((option) =>
    customProvider
      ? option.customProvider?.id === customProvider.id
      : option.customProvider == null && option.provider === model.provider
  );
  const isProviderMissing = customProvider != null && providerOption == null;
  return {
    key,
    provider: providerOption?.provider ?? model.provider,
    customProvider: providerOption?.customProvider ?? customProvider,
    providerName:
      providerOption?.name ??
      customProvider?.name ??
      (isModelProvider(model.provider)
        ? getProviderName(model.provider)
        : model.provider),
    modelName: model.modelName,
    isCurated: isAgentCuratedModelSelection(model),
    displayName: getAgentCuratedModelDisplayName(model),
    credentialState: providerOption?.credentialState ?? "no-key",
    ...(isProviderMissing && { isProviderMissing }),
  };
}

/**
 * Region prefixes of AWS Bedrock cross-region inference profiles, as in
 * `us.anthropic.claude-*` or `global.anthropic.claude-*`: the prefixes the
 * Bedrock preference can apply. Shared by matching (which ignores them) and
 * provider guessing (which reads them as AWS).
 */
export const BEDROCK_REGION_PREFIXES: readonly string[] =
  awsBedrockModelPrefixes.filter((prefix) => prefix !== "");

// The prefixes are lowercase letters and hyphens, so they need no escaping
const BEDROCK_REGION_PREFIX_PATTERN = BEDROCK_REGION_PREFIXES.join("|");

/** `us.`-style region prefix, then a vendor or gateway segment (`anthropic.`, `acme/`) */
const LEADING_MODEL_NAMESPACE_REGEX = new RegExp(
  `^(?:(?:${BEDROCK_REGION_PREFIX_PATTERN})\\.)?[a-z]+[./]`
);

const normalizeWords = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const collapseSeparators = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Match-quality tiers returned by {@link tokenMatchScore}. */
export const MATCH_SCORE = {
  exact: 100,
  prefix: 70,
  substring: 50,
  tokens: 35,
  collapsed: 20,
} as const;

/**
 * How well a model name matches a query, or null for no match. In order:
 * - exact (ignoring case and a Bedrock / gateway prefix like `us.anthropic.`)
 * - prefix, with the same prefix ignored
 * - substring
 * - tokens: every whitespace token starts a word of the name, ignoring
 *   separators, so `opus 5` and `4o mini` hit `claude-opus-5` / `gpt-4o-mini`
 * - collapsed: the query is in the name with all separators removed (`opus5`)
 */
export function tokenMatchScore({
  name,
  query,
}: {
  name: string;
  query: string;
}): number | null {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return null;
  }
  const lowerName = name.toLowerCase();
  // The part after a Bedrock / gateway prefix, so `claude-opus` ranks
  // `claude-opus-*` and `us.anthropic.claude-opus-*` alike on quality
  const bareName = lowerName.replace(LEADING_MODEL_NAMESPACE_REGEX, "");
  if (lowerName === normalizedQuery || bareName === normalizedQuery) {
    return MATCH_SCORE.exact;
  }
  if (
    lowerName.startsWith(normalizedQuery) ||
    bareName.startsWith(normalizedQuery)
  ) {
    return MATCH_SCORE.prefix;
  }
  if (lowerName.includes(normalizedQuery)) {
    return MATCH_SCORE.substring;
  }
  const tokens = normalizeWords(normalizedQuery).split(" ").filter(Boolean);
  const words = normalizeWords(name).split(" ");
  const isEveryTokenAWordStart =
    tokens.length > 0 &&
    tokens.every((token) => words.some((word) => word.startsWith(token)));
  if (isEveryTokenAWordStart) {
    return MATCH_SCORE.tokens;
  }
  const collapsedQuery = collapseSeparators(normalizedQuery);
  if (collapsedQuery && collapseSeparators(name).includes(collapsedQuery)) {
    return MATCH_SCORE.collapsed;
  }
  return null;
}

/** Best match of a row's id and, for curated rows, its display name. */
function getRowMatchScore({
  row,
  query,
}: {
  row: AgentModelCatalogRow;
  query: string;
}): number | null {
  const idScore = tokenMatchScore({ name: row.modelName, query });
  const displayNameScore = row.displayName
    ? tokenMatchScore({ name: row.displayName, query })
    : null;
  if (idScore == null) {
    return displayNameScore;
  }
  return Math.max(idScore, displayNameScore ?? idScore);
}

/**
 * Extra words that name a built-in provider in search, beyond the words of
 * its name: the platform's other name, or its model family where only that
 * provider serves it first-party.
 */
const PROVIDER_SEARCH_ALIASES: Partial<
  Record<GenerativeProviderKey, readonly string[]>
> = {
  AWS: ["bedrock", "amazon"],
  GOOGLE: ["gemini"],
  XAI: ["grok"],
  MOONSHOT: ["kimi"],
};

/**
 * Shortest query token that can name a provider, so `o3` or `gp` never
 * filter by provider.
 */
export const MIN_PROVIDER_TERM_LENGTH = 3;

/**
 * How a query token names a provider:
 * - "name": the whole name, ignoring case and separators (`openai`, `zai`),
 *   or an alias (`bedrock`)
 * - "word": one whole word of the name (`azure` in "Azure OpenAI")
 * - "prefix": the start of the name, a word or an alias (`anth`)
 */
type ProviderTermMatch = "name" | "word" | "prefix";

function matchProviderTerm({
  providerName,
  provider,
  term,
}: {
  providerName: string;
  /** The built-in provider whose aliases apply, or null for none */
  provider: GenerativeProviderKey | null;
  term: string;
}): ProviderTermMatch | null {
  const normalizedTerm = collapseSeparators(term);
  if (normalizedTerm.length < MIN_PROVIDER_TERM_LENGTH) {
    return null;
  }
  const collapsedName = collapseSeparators(providerName);
  const aliases = (provider && PROVIDER_SEARCH_ALIASES[provider]) ?? [];
  if (collapsedName === normalizedTerm || aliases.includes(normalizedTerm)) {
    return "name";
  }
  const words = normalizeWords(providerName).split(" ");
  if (words.includes(normalizedTerm)) {
    return "word";
  }
  const isPrefix = [collapsedName, ...words, ...aliases].some((word) =>
    word.startsWith(normalizedTerm)
  );
  return isPrefix ? "prefix" : null;
}

/** Whether a query token is a whole provider name, word or alias. */
function isCompleteProviderMatch(match: ProviderTermMatch | null): boolean {
  return match === "name" || match === "word";
}

/**
 * Ranking tiers, highest first. A whole provider name or word in the query
 * lists that provider's models above every model-name match. A partly typed
 * one (`anth`) ranks with model-name matches as a prefix match, so the
 * provider's models show while typing without burying `gpt-5-mini` under
 * every MiniMax model for `mini`.
 */
const MATCH_TIER = {
  providerName: 3,
  providerWord: 2,
  model: 1,
} as const;

const PROVIDER_MATCH_TIER: Record<ProviderTermMatch, number> = {
  name: MATCH_TIER.providerName,
  word: MATCH_TIER.providerWord,
  prefix: MATCH_TIER.model,
};

type RowMatch = { tier: number; score: number };

/**
 * A row's best match: its names against the whole query, or its provider
 * against one token with its names against the rest. A provider token alone
 * matches every model of the provider, with a score of 0 for a whole name or
 * word and a prefix score for a partly typed one.
 */
function getRowMatch({
  row,
  query,
}: {
  row: AgentModelCatalogRow;
  query: string;
}): RowMatch | null {
  const nameScore = getRowMatchScore({ row, query });
  let best: RowMatch | null =
    nameScore == null ? null : { tier: MATCH_TIER.model, score: nameScore };
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  tokens.forEach((token, tokenIndex) => {
    const providerMatch = matchProviderTerm({
      providerName: row.providerName,
      provider: row.customProvider ? null : row.provider,
      term: token,
    });
    if (!providerMatch) {
      return;
    }
    const rest = tokens.filter((_, index) => index !== tokenIndex).join(" ");
    const score = rest
      ? getRowMatchScore({ row, query: rest })
      : isCompleteProviderMatch(providerMatch)
        ? 0
        : MATCH_SCORE.prefix;
    if (score == null) {
      return;
    }
    const tier = PROVIDER_MATCH_TIER[providerMatch];
    if (
      !best ||
      tier > best.tier ||
      (tier === best.tier && score > best.score)
    ) {
      best = { tier, score };
    }
  });
  return best;
}

const CREDENTIAL_STATE_ORDER: Record<AgentModelCredentialState, number> = {
  ready: 0,
  "may-work": 1,
  "no-key": 2,
};

/** Sort order of credential states: ready, then may-work, then no-key. */
export function getCredentialStateOrder(
  state: AgentModelCredentialState
): number {
  return CREDENTIAL_STATE_ORDER[state];
}

/**
 * Searches and ranks the catalog. A query token that names a provider
 * (`openai`, `bedrock`, `anth`) filters to that provider's models, with the
 * other tokens matched against their names (`openai mini`); model names are
 * still matched against the whole query too.
 *
 * Rows are ordered by, in turn: match tier (a whole provider name, a whole
 * provider word, then model-name and partly typed provider matches), match
 * quality, curated first, credential state (ready > may-work > no-key),
 * recency, then the shorter id (except when only a provider matched), then
 * catalog order.
 *
 * Rows that match a whole provider name or word aren't capped, so `openai`
 * lists every OpenAI model; `limit` caps the rows after them.
 *
 * An empty query returns nothing.
 *
 * @param params - search inputs
 * @param params.rows - the catalog from {@link buildAgentModelCatalog}
 * @param params.query - the search text
 * @param params.recentModelKeys - row keys (see `getAgentModelKey`), newest first
 * @param params.limit - max rows after the provider matches (default 8)
 */
export function rankAgentModels({
  rows,
  query,
  recentModelKeys = [],
  limit = DEFAULT_AGENT_MODEL_RESULT_LIMIT,
}: {
  rows: readonly AgentModelCatalogRow[];
  query: string;
  recentModelKeys?: readonly string[];
  limit?: number;
}): AgentModelCatalogRow[] {
  if (query.trim().length === 0) {
    return [];
  }
  const recencyByKey = new Map(
    recentModelKeys.map((key, index) => [key, index])
  );
  const scored = rows.flatMap((row, catalogIndex) => {
    const match = getRowMatch({ row, query });
    if (match == null) {
      return [];
    }
    return [
      {
        row,
        matchTier: match.tier,
        matchScore: match.score,
        recency: recencyByKey.get(row.key) ?? Number.POSITIVE_INFINITY,
        catalogIndex,
      },
    ];
  });
  scored.sort(
    (first, second) =>
      second.matchTier - first.matchTier ||
      second.matchScore - first.matchScore ||
      Number(second.row.isCurated) - Number(first.row.isCurated) ||
      getCredentialStateOrder(first.row.credentialState) -
        getCredentialStateOrder(second.row.credentialState) ||
      compareRecency(first.recency, second.recency) ||
      // A provider token alone scores 0 and keeps the server's order
      (first.matchScore > 0
        ? first.row.modelName.length - second.row.modelName.length
        : 0) ||
      first.catalogIndex - second.catalogIndex
  );
  // Sorted by tier first, so the uncapped provider matches lead
  const providerMatchCount = scored.filter(
    ({ matchTier }) => matchTier >= MATCH_TIER.providerWord
  ).length;
  return scored.slice(0, providerMatchCount + limit).map(({ row }) => row);
}

/** Lower index is more recent; Infinity (never picked) ties with itself. */
function compareRecency(first: number, second: number): number {
  if (first === second) {
    return 0;
  }
  return first < second ? -1 : 1;
}

/**
 * Prefix rules for guessing a typed name's provider, checked in order. Bedrock
 * ids come first so `us.anthropic.claude-*` isn't taken for Anthropic.
 */
const PROVIDER_NAME_PATTERNS: readonly {
  pattern: RegExp;
  provider: GenerativeProviderKey;
}[] = [
  {
    pattern: new RegExp(
      `^(?:${BEDROCK_REGION_PREFIX_PATTERN})\\.|^(?:anthropic|amazon|meta|mistral|cohere|deepseek)\\.[a-z]`
    ),
    provider: "AWS",
  },
  { pattern: /^claude/, provider: "ANTHROPIC" },
  { pattern: /^(gpt|chatgpt|o\d)/, provider: "OPENAI" },
  { pattern: /^gemini/, provider: "GOOGLE" },
  { pattern: /^grok/, provider: "XAI" },
  { pattern: /^deepseek/, provider: "DEEPSEEK" },
  { pattern: /^(kimi|moonshot)/, provider: "MOONSHOT" },
  { pattern: /^glm/, provider: "ZAI" },
  { pattern: /^minimax/, provider: "MINIMAX" },
  { pattern: /^sonar/, provider: "PERPLEXITY" },
  // `llama3.2:3b`-style tags are Ollama's
  { pattern: /^[a-z][a-z0-9.-]*:[a-z0-9.]+$/, provider: "OLLAMA" },
];

/**
 * Guesses the built-in provider of a typed model name from its prefix, or
 * null when there's no telling (Azure deployment names, for example).
 */
export function inferProviderFromModelName(
  modelName: string
): GenerativeProviderKey | null {
  const normalizedName = modelName.trim().toLowerCase();
  if (!normalizedName) {
    return null;
  }
  return (
    PROVIDER_NAME_PATTERNS.find(({ pattern }) => pattern.test(normalizedName))
      ?.provider ?? null
  );
}

/**
 * The query as a custom model name, with the providers to offer it to.
 * Returns null when there's nothing to offer: the query is empty, contains
 * whitespace (no model id does, so it's a search), names a provider
 * (`openai` lists OpenAI's models), or there are no providers.
 *
 * A name that matches a listed id is still offered: the same id can be sent
 * to another provider (a gateway, an Azure deployment of the same name).
 *
 * The provider guessed from the name comes first if it's installed, whatever
 * its credentials, since a no-key pick goes to the credential form. The rest
 * follow by credential state (ready, may-work, no-key), in provider order.
 *
 * @param params - inputs
 * @param params.query - the search text
 * @param params.providers - from {@link buildAgentModelProviderOptions}
 */
export function getAgentModelCustomModelOption({
  query,
  providers,
}: {
  query: string;
  providers: readonly AgentModelProviderOption[];
}): AgentModelCustomModelOption | null {
  const modelName = query.trim();
  if (!modelName || /\s/.test(modelName) || providers.length === 0) {
    return null;
  }
  const isProviderSearch = providers.some((option) =>
    isCompleteProviderMatch(
      matchProviderTerm({
        providerName: option.name,
        provider: option.customProvider ? null : option.provider,
        term: modelName,
      })
    )
  );
  if (isProviderSearch) {
    return null;
  }
  const guessedProviderKey = inferProviderFromModelName(modelName);
  const guessedProvider = guessedProviderKey
    ? (providers.find(
        (option) =>
          option.customProvider == null &&
          option.provider === guessedProviderKey
      ) ?? null)
    : null;
  const otherProviders = providers
    .filter((option) => option !== guessedProvider)
    .toSorted(
      (first, second) =>
        getCredentialStateOrder(first.credentialState) -
        getCredentialStateOrder(second.credentialState)
    );
  return {
    modelName,
    providers: guessedProvider
      ? [guessedProvider, ...otherProviders]
      : otherProviders,
    guessedProviderKey: guessedProvider?.key ?? null,
  };
}

/**
 * The query tokens that name a row's provider, to highlight in its provider
 * label: so `openai mini` marks "OpenAI" but `pen` doesn't mark it.
 */
export function getAgentModelProviderHighlightQuery({
  row,
  query,
}: {
  row: Pick<
    AgentModelCatalogRow,
    "provider" | "customProvider" | "providerName"
  >;
  query: string;
}): string {
  return query
    .trim()
    .split(/\s+/)
    .filter(
      (token) =>
        matchProviderTerm({
          providerName: row.providerName,
          provider: row.customProvider ? null : row.provider,
          term: token,
        }) != null
    )
    .join(" ");
}

/** A `[start, end)` character range to highlight. */
export type AgentModelHighlightRange = readonly [start: number, end: number];

const isWordCharacter = (char: string | undefined) =>
  char != null && /[a-z0-9]/i.test(char);

/**
 * Where to highlight a query in a model name or display name, in order:
 * - the whole query, if it appears as is (`claude-op` in `claude-opus-5`)
 * - otherwise each whitespace token, preferring an occurrence at a word start
 *   (so `opus 5` marks `opus` and the `5` of `claude-opus-5`), without overlaps
 *
 * Matching ignores case. Returns sorted, non-overlapping ranges, or none for
 * an empty query.
 *
 * @param params - inputs
 * @param params.text - the text shown in the row
 * @param params.query - the search text
 */
export function getAgentModelHighlightRanges({
  text,
  query,
}: {
  text: string;
  query: string;
}): AgentModelHighlightRange[] {
  const lowerText = text.toLowerCase();
  const wholeQuery = query.trim().toLowerCase();
  if (!wholeQuery) {
    return [];
  }
  const wholeIndex = lowerText.indexOf(wholeQuery);
  if (wholeIndex >= 0) {
    return [[wholeIndex, wholeIndex + wholeQuery.length]];
  }
  const ranges: AgentModelHighlightRange[] = [];
  const tokens = wholeQuery.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const occurrences: number[] = [];
    for (
      let index = lowerText.indexOf(token);
      index >= 0;
      index = lowerText.indexOf(token, index + 1)
    ) {
      occurrences.push(index);
    }
    const isFree = (start: number) =>
      !ranges.some(
        ([rangeStart, rangeEnd]) =>
          start < rangeEnd && start + token.length > rangeStart
      );
    const start =
      occurrences.find(
        (index) => isFree(index) && !isWordCharacter(lowerText[index - 1])
      ) ?? occurrences.find(isFree);
    if (start != null) {
      ranges.push([start, start + token.length]);
    }
  }
  return ranges.sort((first, second) => first[0] - second[0]);
}
