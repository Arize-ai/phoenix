/**
 * Pure search and catalog logic shared by the model pickers (the playground's
 * `ModelMenu` and the PXI `AgentModelPicker`): a flat catalog of the models a
 * picker offers, token search with ranking (where a provider name in the
 * query filters to that provider), provider guessing for typed names, and the
 * provider list offered for a typed custom model name.
 *
 * Everything here works from the data `useModelMenuData` returns. Pickers
 * differ only in their inputs: which providers and models they pass, how a
 * provider's credential state is judged (PXI counts server-side credentials
 * only, the playground browser-local keys too), and which models are curated.
 */
import type {
  CustomProviderRef,
  ModelMenuValue,
} from "@phoenix/components/generative/ModelMenu";
import {
  BEDROCK_REGION_PREFIXES,
  getProviderKeyForGenerativeModelSDK,
  providerRequiresCredentials,
  providerSupportsDefaultCredentialChain,
  type ProviderCredentialStatus,
  stripBedrockRegionPrefix,
} from "@phoenix/components/generative/modelProviderUtils";
import type {
  CustomProviderInfo,
  GenerativeProviderKey,
} from "@phoenix/components/generative/useModelMenuData";
import {
  getProviderName,
  isModelProvider,
} from "@phoenix/utils/generativeUtils";

/**
 * Whether a picker's execution path can authenticate with a provider:
 * - "ready": credentials are set, or none are needed
 * - "may-work": none are set, but the provider can fall back to an ambient
 *   default credential chain the server can't detect (AWS, Azure)
 * - "no-key": credentials are required and missing
 */
export type ModelCredentialState = "ready" | "may-work" | "no-key";

/** A provider models can be picked from: a built-in one or a custom one. */
export type ModelProviderOption = {
  /** Stable id: the provider key, or `custom:<id>` for a custom provider */
  key: string;
  /** Built-in provider key; for a custom provider, the key of its SDK */
  provider: GenerativeProviderKey;
  customProvider: CustomProviderRef | null;
  /** Human-readable provider name */
  name: string;
  credentialState: ModelCredentialState;
};

/** One pickable model in the flat catalog. */
export type ModelCatalogRow = {
  /** Stable id, see {@link getModelKey} */
  key: string;
  provider: GenerativeProviderKey;
  customProvider: CustomProviderRef | null;
  /** Human-readable provider name */
  providerName: string;
  modelName: string;
  isCurated: boolean;
  /** Curated display name, or null to show the raw id */
  displayName: string | null;
  credentialState: ModelCredentialState;
  /**
   * Set on a resolved selection whose custom provider no longer exists, see
   * {@link resolveModelRow}. Catalog rows never set it.
   */
  isProviderMissing?: boolean;
};

/** A typed name to offer as a custom model, with the providers it can use. */
export type CustomModelOption = {
  modelName: string;
  /**
   * The providers to offer, in order: the one guessed from the name, then
   * ready, may-work and no-key providers (otherwise in provider order)
   */
  providers: ModelProviderOption[];
  /** Key of the provider guessed from the name, when it's offered */
  guessedProviderKey: string | null;
};

/**
 * Which models a picker recommends, and the names it shows for them. PXI
 * curates a short list; pickers without one pass nothing.
 */
export type ModelCuration = {
  isCurated: (model: ModelMenuValue) => boolean;
  getDisplayName: (model: ModelMenuValue) => string | null;
};

const NO_CURATION: ModelCuration = {
  isCurated: () => false,
  getDisplayName: () => null,
};

const DEFAULT_MODEL_RESULT_LIMIT = 8;

/** The data `useModelMenuData` returns that the catalog is built from. */
export type ModelCatalogInput = {
  /** Built-in models, e.g. `playgroundModels` or the decision catalog */
  models: readonly {
    readonly name: string;
    readonly providerKey: GenerativeProviderKey;
  }[];
  modelProviders: readonly (ProviderCredentialStatus & {
    readonly key: GenerativeProviderKey;
    readonly name: string;
  })[];
  customProviders: readonly CustomProviderInfo[];
};

/**
 * The stable id of a provider: the built-in provider key, or `custom:<id>`
 * for a custom provider.
 *
 * @param params - the provider
 * @param params.provider - built-in provider key (the SDK's key for custom providers)
 * @param params.customProviderId - custom provider id, if any
 */
export function getModelProviderKey({
  provider,
  customProviderId,
}: {
  provider: string;
  customProviderId?: string | null;
}): string {
  return customProviderId ? `custom:${customProviderId}` : provider;
}

/**
 * The stable id of a model selection, used for picker row keys, recency
 * lookups and recent-model dedupe.
 *
 * @param params - the selection
 * @param params.provider - built-in provider key (the SDK's key for custom providers)
 * @param params.customProviderId - custom provider id, if any
 * @param params.modelName - the model id
 */
export function getModelKey({
  provider,
  customProviderId,
  modelName,
}: {
  provider: string;
  customProviderId?: string | null;
  modelName: string;
}): string {
  return `${getModelProviderKey({ provider, customProviderId })}:${modelName}`;
}

/** {@link getModelKey} for a picker value. */
export function getModelKeyForValue(model: ModelMenuValue): string {
  return getModelKey({
    provider: model.provider,
    customProviderId: model.customProvider?.id,
    modelName: model.modelName,
  });
}

/** The picker value to emit when a catalog row is picked. */
export function toModelMenuValueFromRow(
  row: Pick<ModelCatalogRow, "provider" | "customProvider" | "modelName">
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
): ModelCredentialState {
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
 * A built-in provider's credential state from the `needsCredentials` flag
 * `useModelMenuData` sets for the surface's credential source, so
 * browser-local keys count where the surface sends them (the playground).
 */
export function getProviderCredentialStateFromNeeds(provider: {
  key: string;
  needsCredentials?: boolean;
}): ModelCredentialState {
  if (!provider.needsCredentials) {
    return "ready";
  }
  return providerSupportsDefaultCredentialChain({ providerKey: provider.key })
    ? "may-work"
    : "no-key";
}

/**
 * Every provider a picker can pick from: built-in providers with their server
 * dependencies installed (in the given order), then custom providers.
 *
 * Custom providers are always "ready": their credentials live in the
 * provider's own server-side config, which Settings requires when the
 * provider is created, so the built-in provider's env-var status says nothing
 * about them. As in `ModelMenu`, they aren't filtered by dependencies.
 *
 * @param params - inputs
 * @param params.modelProviders - the built-in providers to offer
 * @param params.customProviders - the custom providers to offer
 * @param params.getCredentialState - a built-in provider's credential state;
 *   defaults to server-side credentials only, see
 *   {@link getProviderCredentialState}
 */
export function buildModelProviderOptions<
  Provider extends ModelCatalogInput["modelProviders"][number],
>({
  modelProviders,
  customProviders,
  getCredentialState = getProviderCredentialState,
}: {
  modelProviders: readonly Provider[];
  customProviders: ModelCatalogInput["customProviders"];
  getCredentialState?: (provider: Provider) => ModelCredentialState;
}): ModelProviderOption[] {
  const builtIn = modelProviders
    .filter((provider) => provider.dependenciesInstalled)
    .map(
      (provider): ModelProviderOption => ({
        key: getModelProviderKey({ provider: provider.key }),
        provider: provider.key,
        customProvider: null,
        name: provider.name,
        credentialState: getCredentialState(provider),
      })
    );
  const custom = customProviders.map((customProvider): ModelProviderOption => {
    const provider = getProviderKeyForGenerativeModelSDK(customProvider.sdk);
    return {
      key: getModelProviderKey({
        provider,
        customProviderId: customProvider.id,
      }),
      provider,
      customProvider: { id: customProvider.id, name: customProvider.name },
      name: customProvider.name,
      credentialState: "ready",
    };
  });
  return [...builtIn, ...custom];
}

/**
 * The flat model catalog: built-in models, then each custom provider's model
 * names, for the providers in `providers` (so built-in providers without
 * their dependencies are left out). Rows keep the server's order; ranking
 * happens in {@link rankModels}.
 *
 * @param params - inputs
 * @param params.models - built-in models, from `useModelMenuData`
 * @param params.providers - from {@link buildModelProviderOptions}
 * @param params.customProviders - custom providers with their model names
 * @param params.curation - the picker's recommended models, if any
 */
export function buildModelCatalog({
  models,
  providers,
  customProviders,
  curation = NO_CURATION,
}: Pick<ModelCatalogInput, "models" | "customProviders"> & {
  providers: readonly ModelProviderOption[];
  curation?: ModelCuration;
}): ModelCatalogRow[] {
  const providersByKey = new Map(
    providers.map((option) => [option.key, option])
  );
  const builtInRows = models.flatMap((model): ModelCatalogRow[] => {
    const option = providersByKey.get(
      getModelProviderKey({ provider: model.providerKey })
    );
    if (!option) {
      return [];
    }
    const value: ModelMenuValue = {
      provider: model.providerKey,
      modelName: model.name,
    };
    return [
      {
        key: getModelKeyForValue(value),
        provider: model.providerKey,
        customProvider: null,
        providerName: option.name,
        modelName: model.name,
        isCurated: curation.isCurated(value),
        displayName: curation.getDisplayName(value),
        credentialState: option.credentialState,
      },
    ];
  });
  const customRows = customProviders.flatMap(
    (customProvider): ModelCatalogRow[] => {
      const option = providersByKey.get(
        getModelProviderKey({
          provider: getProviderKeyForGenerativeModelSDK(customProvider.sdk),
          customProviderId: customProvider.id,
        })
      );
      if (!option?.customProvider) {
        return [];
      }
      const optionCustomProvider = option.customProvider;
      return customProvider.modelNames.map(
        (modelName): ModelCatalogRow => ({
          key: getModelKey({
            provider: option.provider,
            customProviderId: optionCustomProvider.id,
            modelName,
          }),
          provider: option.provider,
          customProvider: optionCustomProvider,
          providerName: option.name,
          modelName,
          isCurated: false,
          displayName: null,
          credentialState: option.credentialState,
        })
      );
    }
  );
  return [...builtInRows, ...customRows];
}

/**
 * The row to show for a model selection that may not be in the catalog: the
 * current model, or a recent pick such as a typed name or a Bedrock id with
 * the region prefix applied. A catalog row is returned as is, and a Bedrock
 * id with a known region resolves to its unprefixed catalog row, so picking
 * it applies the current region preference. Otherwise the row is built from
 * the selection and its provider option:
 * - a custom provider that's gone (`resolvePersistedAgentModel` names it
 *   "Deleted provider") keeps the selection's provider name, and is
 *   "no-key" with `isProviderMissing` set
 * - a built-in provider that isn't installed is "no-key" too
 *
 * @param params - inputs
 * @param params.model - the selection to show
 * @param params.rows - the catalog from {@link buildModelCatalog}
 * @param params.providers - from {@link buildModelProviderOptions}
 * @param params.curation - the picker's recommended models, if any
 */
export function resolveModelRow({
  model,
  rows,
  providers,
  curation = NO_CURATION,
}: {
  model: ModelMenuValue;
  rows: readonly ModelCatalogRow[];
  providers: readonly ModelProviderOption[];
  curation?: ModelCuration;
}): ModelCatalogRow {
  const key = getModelKeyForValue(model);
  const unprefixedKey =
    model.provider === "AWS"
      ? getModelKeyForValue({
          ...model,
          modelName: stripBedrockRegionPrefix(model.modelName),
        })
      : key;
  const catalogRow =
    rows.find((row) => row.key === key) ??
    rows.find((row) => row.key === unprefixedKey);
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
    isCurated: curation.isCurated(model),
    displayName: curation.getDisplayName(model),
    credentialState: providerOption?.credentialState ?? "no-key",
    ...(isProviderMissing && { isProviderMissing }),
  };
}

// The prefixes are lowercase letters and hyphens, so they need no escaping
const BEDROCK_REGION_PREFIX_PATTERN = BEDROCK_REGION_PREFIXES.join("|");

/** `us.`-style region prefix, then a vendor or gateway segment (`anthropic.`, `acme/`) */
const LEADING_MODEL_NAMESPACE_REGEX = new RegExp(
  `^(?:(?:${BEDROCK_REGION_PREFIX_PATTERN})\\.)?[a-z]+[./]`
);

/**
 * Lowercase text without its Bedrock / gateway prefix, or the whole text when
 * that's all there is (a bare `us.` or `anthropic.`)
 */
const stripModelNamespace = (text: string) => {
  const lowerText = text.toLowerCase();
  return lowerText.replace(LEADING_MODEL_NAMESPACE_REGEX, "") || lowerText;
};

const normalizeWords = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const collapseSeparators = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** The whitespace-separated tokens of a search query. */
const tokenizeQuery = (query: string) =>
  query.trim().split(/\s+/).filter(Boolean);

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
 * - exact (ignoring case and a Bedrock / gateway prefix like `us.anthropic.`
 *   on either side, so a pasted Bedrock id finds the model under any provider)
 * - prefix, with the same prefixes ignored
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
  // The parts after a Bedrock / gateway prefix, so `claude-opus` ranks
  // `claude-opus-*` and `us.anthropic.claude-opus-*` alike on quality, and a
  // pasted `us.anthropic.claude-opus` finds both
  const bareName = stripModelNamespace(lowerName);
  const bareQuery = stripModelNamespace(normalizedQuery);
  if (lowerName === normalizedQuery || bareName === bareQuery) {
    return MATCH_SCORE.exact;
  }
  if (lowerName.startsWith(normalizedQuery) || bareName.startsWith(bareQuery)) {
    return MATCH_SCORE.prefix;
  }
  if (lowerName.includes(bareQuery)) {
    return MATCH_SCORE.substring;
  }
  const tokens = normalizeWords(bareQuery).split(" ").filter(Boolean);
  const words = normalizeWords(name).split(" ");
  const isEveryTokenAWordStart =
    tokens.length > 0 &&
    tokens.every((token) => words.some((word) => word.startsWith(token)));
  if (isEveryTokenAWordStart) {
    return MATCH_SCORE.tokens;
  }
  const collapsedQuery = collapseSeparators(bareQuery);
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
  row: ModelCatalogRow;
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
const MIN_PROVIDER_TERM_LENGTH = 3;

/**
 * How a query token names a provider:
 * - "name": the whole name, ignoring case and separators (`openai`, `zai`),
 *   or an alias (`bedrock`)
 * - "word": one whole word of the name (`azure` in "Azure OpenAI")
 * - "prefix": the start of the name, a word or an alias (`anth`)
 */
type ProviderTermMatch = "name" | "word" | "prefix";

/** The provider of a row or provider option, as matched by search. */
type ProviderSearchTarget = Pick<
  ModelCatalogRow,
  "providerName" | "provider" | "customProvider"
>;

/**
 * How a query token names a provider, or null if it doesn't. Aliases apply
 * to built-in providers only, so a custom provider on the AWS SDK isn't
 * matched by `bedrock`.
 */
function matchProviderTerm({
  target,
  term,
}: {
  target: ProviderSearchTarget;
  term: string;
}): ProviderTermMatch | null {
  const normalizedTerm = collapseSeparators(term);
  if (normalizedTerm.length < MIN_PROVIDER_TERM_LENGTH) {
    return null;
  }
  const { providerName } = target;
  const collapsedName = collapseSeparators(providerName);
  const aliases = target.customProvider
    ? []
    : (PROVIDER_SEARCH_ALIASES[target.provider] ?? []);
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
 * every MiniMax model for `mini`. A word match ranks with model-name matches
 * too when another provider's whole name is in the query, so `openai` lists
 * OpenAI's models without every Azure OpenAI one.
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
  tokens,
  isProviderNameInQuery,
}: {
  row: ModelCatalogRow;
  /** The trimmed search text */
  query: string;
  /** The query's tokens, see {@link tokenizeQuery} */
  tokens: readonly string[];
  /** Whether some provider's whole name is in the query, see {@link MATCH_TIER} */
  isProviderNameInQuery: boolean;
}): RowMatch | null {
  const nameScore = getRowMatchScore({ row, query });
  let best: RowMatch | null =
    nameScore == null ? null : { tier: MATCH_TIER.model, score: nameScore };
  tokens.forEach((token, tokenIndex) => {
    const providerMatch = matchProviderTerm({ target: row, term: token });
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
    const tier =
      providerMatch === "word" && isProviderNameInQuery
        ? MATCH_TIER.model
        : PROVIDER_MATCH_TIER[providerMatch];
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

/** Sort order of credential states: ready, then may-work, then no-key. */
const CREDENTIAL_STATE_ORDER: Record<ModelCredentialState, number> = {
  ready: 0,
  "may-work": 1,
  "no-key": 2,
};

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
 * lists every OpenAI model; `limit` caps the rows after them. When some
 * provider's whole name is in the query, word matches rank and are capped
 * with model-name matches instead: `openai` lists every OpenAI model, then
 * at most `limit` others, Azure OpenAI's among them. `azure`, which names no
 * provider whole, still lists every Azure OpenAI model.
 *
 * An empty query returns nothing.
 *
 * @param params - search inputs
 * @param params.rows - the catalog from {@link buildModelCatalog}
 * @param params.query - the search text
 * @param params.recentModelKeys - row keys (see `getModelKey`), newest first
 * @param params.limit - max rows after the provider matches (default 8)
 */
export function rankModels({
  rows,
  query,
  recentModelKeys = [],
  limit = DEFAULT_MODEL_RESULT_LIMIT,
}: {
  rows: readonly ModelCatalogRow[];
  query: string;
  recentModelKeys?: readonly string[];
  limit?: number;
}): ModelCatalogRow[] {
  const trimmedQuery = query.trim();
  const tokens = tokenizeQuery(trimmedQuery);
  if (tokens.length === 0) {
    return [];
  }
  const recencyByKey = new Map(
    recentModelKeys.map((key, index) => [key, index])
  );
  // One row per provider, so each provider's name is matched once
  const providerTargets = [
    ...new Map(
      rows.map((row) => [
        getModelProviderKey({
          provider: row.provider,
          customProviderId: row.customProvider?.id,
        }),
        row,
      ])
    ).values(),
  ];
  const isProviderNameInQuery = providerTargets.some((target) =>
    tokens.some(
      (token) => matchProviderTerm({ target, term: token }) === "name"
    )
  );
  const scored = rows.flatMap((row, catalogIndex) => {
    const match = getRowMatch({
      row,
      query: trimmedQuery,
      tokens,
      isProviderNameInQuery,
    });
    if (match == null) {
      return [];
    }
    return [
      {
        row,
        matchTier: match.tier,
        matchScore: match.score,
        // Never picked sorts after every recent pick
        recency: recencyByKey.get(row.key) ?? recentModelKeys.length,
        catalogIndex,
      },
    ];
  });
  scored.sort(
    (first, second) =>
      second.matchTier - first.matchTier ||
      second.matchScore - first.matchScore ||
      Number(second.row.isCurated) - Number(first.row.isCurated) ||
      CREDENTIAL_STATE_ORDER[first.row.credentialState] -
        CREDENTIAL_STATE_ORDER[second.row.credentialState] ||
      first.recency - second.recency ||
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

/** One provider's matches in {@link searchModelsByProvider}. */
export type ModelProviderSearchSection = {
  provider: ModelProviderOption;
  rows: ModelCatalogRow[];
};

/**
 * {@link rankModels} for pickers that list matches under their provider, as
 * the playground's `ModelMenu` does: every match (uncapped), grouped by
 * provider with custom providers first, then built-in providers, each in the
 * given order, and ranked within a provider. Providers without a match are
 * left out. An empty query returns nothing.
 *
 * @param params - inputs
 * @param params.rows - the catalog from {@link buildModelCatalog}
 * @param params.providers - from {@link buildModelProviderOptions}
 * @param params.query - the search text
 */
export function searchModelsByProvider({
  rows,
  providers,
  query,
}: {
  rows: readonly ModelCatalogRow[];
  providers: readonly ModelProviderOption[];
  query: string;
}): ModelProviderSearchSection[] {
  const rowsByProviderKey = new Map<string, ModelCatalogRow[]>();
  for (const row of rankModels({ rows, query, limit: Infinity })) {
    const providerKey = getModelProviderKey({
      provider: row.provider,
      customProviderId: row.customProvider?.id,
    });
    rowsByProviderKey.set(providerKey, [
      ...(rowsByProviderKey.get(providerKey) ?? []),
      row,
    ]);
  }
  return [
    ...providers.filter((provider) => provider.customProvider != null),
    ...providers.filter((provider) => provider.customProvider == null),
  ].flatMap((provider) => {
    const providerRows = rowsByProviderKey.get(provider.key);
    return providerRows ? [{ provider, rows: providerRows }] : [];
  });
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
 * Offered for every search, so a custom model is always one step away;
 * returns null only when the query is empty, contains whitespace (no model
 * id does, so it's a search), or there are no providers.
 *
 * A name that matches a listed id or a provider is still offered: the same
 * id can be sent to another provider (a gateway, an Azure deployment of the
 * same name).
 *
 * The provider guessed from the name comes first if it's installed, whatever
 * its credentials, since a no-key pick goes to the credential form. The rest
 * follow by credential state (ready, may-work, no-key), in provider order.
 *
 * @param params - inputs
 * @param params.query - the search text
 * @param params.providers - from {@link buildModelProviderOptions}
 */
export function getCustomModelOption({
  query,
  providers,
}: {
  query: string;
  providers: readonly ModelProviderOption[];
}): CustomModelOption | null {
  const modelName = query.trim();
  if (!modelName || /\s/.test(modelName) || providers.length === 0) {
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
        CREDENTIAL_STATE_ORDER[first.credentialState] -
        CREDENTIAL_STATE_ORDER[second.credentialState]
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
export function getProviderHighlightQuery({
  row,
  query,
}: {
  row: Pick<ModelCatalogRow, "provider" | "customProvider" | "providerName">;
  query: string;
}): string {
  return tokenizeQuery(query)
    .filter((token) => matchProviderTerm({ target: row, term: token }) != null)
    .join(" ");
}

/** A `[start, end)` character range to highlight. */
type ModelHighlightRange = readonly [start: number, end: number];

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
export function getModelHighlightRanges({
  text,
  query,
}: {
  text: string;
  query: string;
}): ModelHighlightRange[] {
  const lowerText = text.toLowerCase();
  const wholeQuery = query.trim().toLowerCase();
  if (!wholeQuery) {
    return [];
  }
  // The whole query, else without a pasted Bedrock / gateway prefix
  for (const candidate of new Set([
    wholeQuery,
    stripModelNamespace(wholeQuery),
  ])) {
    const wholeIndex = lowerText.indexOf(candidate);
    if (wholeIndex >= 0) {
      return [[wholeIndex, wholeIndex + candidate.length]];
    }
  }
  const ranges: ModelHighlightRange[] = [];
  for (const token of tokenizeQuery(wholeQuery)) {
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
