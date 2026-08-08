import {
  AudioAttributesPostfixes,
  DocumentAttributePostfixes,
  EmbeddingAttributePostfixes,
  ImageAttributesPostfixes,
  LLMProvider,
  LLMSystem,
  MessageAttributePostfixes,
  MessageContentsAttributePostfixes,
  MimeType,
  OpenInferenceSpanKind,
  SemanticAttributePrefixes,
  SemanticConventions,
  ToolAttributePostfixes,
  ToolCallAttributePostfixes,
} from "@arizeai/openinference-semantic-conventions";
import type {
  Completion,
  CompletionContext,
  CompletionResult,
  CompletionSection,
  CompletionSource,
} from "@codemirror/autocomplete";
import type { EditorView } from "@uiw/react-codemirror";

/**
 * Shape exposed by `@arizeai/openinference-semantic-conventions`: enum keys map
 * to dotted OpenInference attribute paths such as `llm.provider`.
 */
type SemanticConventionMap = Readonly<Record<string, string>>;

/**
 * A segment in the backend filter DSL's attribute accessor syntax. Strings
 * become quoted subscripts (`['llm']`), while numbers become list indexes
 * (`[0]`).
 */
type AttributePathSegment = string | number;

/**
 * Enum values that should be offered after a specific field is compared with
 * `==` or `!=`.
 */
type OpenInferenceAttributeValueCompletionConfig = {
  accessor: string;
  detail: string;
  values: readonly string[];
};

/**
 * The partially typed enum-value expression immediately before the cursor.
 */
type OpenInferenceAttributeValueCompletionContext = {
  accessor: string;
  quote: "'" | '"';
  typedText: string;
};

/**
 * A completion-ready attribute path plus the display path shown in the detail
 * column. These can differ because indexed list traversals are shown as
 * `llm.input_messages[0].message.role`, not as a raw accessor.
 */
type SemanticConventionAttributePath = {
  pathSegments: readonly AttributePathSegment[];
  detail: string;
};

const DEFAULT_SEMANTIC_CONVENTIONS: SemanticConventionMap = SemanticConventions;
const SPAN_KIND_FIELD = "span_kind";
/**
 * Completions must include an explicit list index for nested OpenInference
 * structures. The backend DSL supports integer subscripts but does not provide
 * wildcard traversal, so `attributes['llm']['input_messages']['message']...`
 * is invalid whereas `attributes['llm']['input_messages'][0]...` is meaningful.
 */
const LIST_ITEM_INDEX = 0;

const openInferenceAttributesSection: CompletionSection = {
  name: "Attributes",
  rank: 4,
};
const openInferenceAttributeValuesSection: CompletionSection = {
  name: "OpenInference values",
  rank: 2,
};

const quotedAccessorSegmentSource = String.raw`(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|(\d+))`;
const attributeAccessorSource = String.raw`attributes(?:\[(?:${quotedAccessorSegmentSource})\])+`;
const attributeValueContextPattern = new RegExp(
  String.raw`(?:^|[^\w.])(?<accessor>${SPAN_KIND_FIELD}|${attributeAccessorSource})\s*(?:==|!=)\s*(?<quote>['"])(?<typedText>[^'"]*)$`
);
const attributeAccessorSegmentPattern = new RegExp(
  String.raw`\[${quotedAccessorSegmentSource}\]`,
  "g"
);

/**
 * Converts the semantic-conventions package's dotted path representation into
 * independent DSL accessor segments.
 */
function semanticConventionPathToSegments(
  semanticConventionPath: string
): string[] {
  return semanticConventionPath.split(".");
}

function createNestedOnlySemanticConventionPaths({
  prefix,
  postfixes,
}: {
  prefix: string;
  postfixes: Readonly<Record<string, string>>;
}): string[] {
  return Object.values(postfixes).map((postfix) => `${prefix}.${postfix}`);
}

/**
 * Postfix convention groups describe objects nested inside list-valued
 * attributes. The semantic-conventions package publishes them as standalone
 * dotted paths (`message.role`, `document.id`, `tool_call.id`, etc.), but
 * Phoenix stores them under list roots like `llm.input_messages[0]` and
 * `retrieval.documents[0]`. Offering the standalone paths as top-level
 * `attributes[...]` filters creates valid-looking filters that match no spans.
 */
const nestedOnlySemanticConventionPaths = new Set<string>([
  ...createNestedOnlySemanticConventionPaths({
    prefix: SemanticAttributePrefixes.message,
    postfixes: MessageAttributePostfixes,
  }),
  ...createNestedOnlySemanticConventionPaths({
    prefix: SemanticAttributePrefixes.message_content,
    postfixes: MessageContentsAttributePostfixes,
  }),
  ...createNestedOnlySemanticConventionPaths({
    prefix: SemanticAttributePrefixes.tool_call,
    postfixes: ToolCallAttributePostfixes,
  }),
  ...createNestedOnlySemanticConventionPaths({
    prefix: SemanticAttributePrefixes.document,
    postfixes: DocumentAttributePostfixes,
  }),
  ...createNestedOnlySemanticConventionPaths({
    prefix: SemanticAttributePrefixes.image,
    postfixes: ImageAttributesPostfixes,
  }),
  ...createNestedOnlySemanticConventionPaths({
    prefix: SemanticAttributePrefixes.audio,
    postfixes: AudioAttributesPostfixes,
  }),
  `${SemanticAttributePrefixes.embedding}.${EmbeddingAttributePostfixes.text}`,
  `${SemanticAttributePrefixes.embedding}.${EmbeddingAttributePostfixes.vector}`,
]);

/**
 * Paths that are OpenInference conventions but should not be offered as
 * `attributes[...]` filters. `openinference.span.kind` is ingested into the
 * dedicated `span_kind` column in the REST v1 path, and metadata has its own
 * typed filter surface.
 */
const hiddenTopLevelSemanticConventionPaths = new Set<string>([
  SemanticConventions.METADATA,
  SemanticConventions.OPENINFERENCE_SPAN_KIND,
]);

/**
 * Returns whether a semantic-convention path is stored as a top-level span
 * attribute in Phoenix.
 */
function isTopLevelSemanticConventionPath(
  semanticConventionPath: string
): boolean {
  return (
    !hiddenTopLevelSemanticConventionPaths.has(semanticConventionPath) &&
    !nestedOnlySemanticConventionPaths.has(semanticConventionPath)
  );
}

/**
 * Formats path segments for the completion detail column. This intentionally
 * resembles OpenInference dotted paths while keeping list indexes visible.
 */
function attributePathSegmentsToDetailPath(
  pathSegments: readonly AttributePathSegment[]
): string {
  return pathSegments
    .map((pathSegment, index) => {
      if (typeof pathSegment === "number") {
        return `[${pathSegment}]`;
      }
      return index === 0 ? pathSegment : `.${pathSegment}`;
    })
    .join("");
}

/**
 * Builds a nested list traversal by inserting the required list item index
 * between a list-valued root and the object's per-item convention path.
 */
function createIndexedNestedAttributePath({
  listRootPath,
  itemPathSegments,
}: {
  listRootPath: string;
  itemPathSegments: readonly AttributePathSegment[];
}): SemanticConventionAttributePath {
  const pathSegments = [
    ...semanticConventionPathToSegments(listRootPath),
    LIST_ITEM_INDEX,
    ...itemPathSegments,
  ];
  return {
    pathSegments,
    detail: attributePathSegmentsToDetailPath(pathSegments),
  };
}

/**
 * Expands LLM message list roots into the conventions that actually live on
 * each message item: `message.*`, `message.contents[0].message_content.*`, and
 * `message.tool_calls[0].tool_call.*`.
 */
function createMessageAttributePaths({
  listRootPath,
}: {
  listRootPath: string;
}): SemanticConventionAttributePath[] {
  const messageAttributePaths = Object.values(MessageAttributePostfixes).map(
    (postfix) =>
      createIndexedNestedAttributePath({
        listRootPath,
        itemPathSegments: [
          SemanticAttributePrefixes.message,
          ...semanticConventionPathToSegments(postfix),
        ],
      })
  );
  const messageContentAttributePaths = Object.values(
    MessageContentsAttributePostfixes
  ).map((postfix) =>
    createIndexedNestedAttributePath({
      listRootPath,
      itemPathSegments: [
        SemanticAttributePrefixes.message,
        MessageAttributePostfixes.contents,
        LIST_ITEM_INDEX,
        SemanticAttributePrefixes.message_content,
        ...semanticConventionPathToSegments(postfix),
      ],
    })
  );
  const messageContentImageAttributePath = createIndexedNestedAttributePath({
    listRootPath,
    itemPathSegments: [
      SemanticAttributePrefixes.message,
      MessageAttributePostfixes.contents,
      LIST_ITEM_INDEX,
      ...semanticConventionPathToSegments(
        SemanticConventions.MESSAGE_CONTENT_IMAGE
      ),
      ...semanticConventionPathToSegments(SemanticConventions.IMAGE_URL),
    ],
  });
  const toolCallAttributePaths = Object.values(ToolCallAttributePostfixes).map(
    (postfix) =>
      createIndexedNestedAttributePath({
        listRootPath,
        itemPathSegments: [
          SemanticAttributePrefixes.message,
          MessageAttributePostfixes.tool_calls,
          LIST_ITEM_INDEX,
          SemanticAttributePrefixes.tool_call,
          ...semanticConventionPathToSegments(postfix),
        ],
      })
  );

  return [
    ...messageAttributePaths,
    ...messageContentAttributePaths,
    messageContentImageAttributePath,
    ...toolCallAttributePaths,
  ];
}

/**
 * Nested OpenInference conventions that Phoenix can traverse when the filter
 * includes a concrete list index. Each completion uses `[0]` as an editable
 * placeholder index so users see the required shape of the DSL.
 */
const defaultNestedSemanticConventionAttributePaths: readonly SemanticConventionAttributePath[] =
  [
    ...createMessageAttributePaths({
      listRootPath: SemanticConventions.LLM_INPUT_MESSAGES,
    }),
    ...createMessageAttributePaths({
      listRootPath: SemanticConventions.LLM_OUTPUT_MESSAGES,
    }),
    createIndexedNestedAttributePath({
      listRootPath: SemanticConventions.LLM_TOOLS,
      itemPathSegments: [
        SemanticAttributePrefixes.tool,
        ToolAttributePostfixes.json_schema,
      ],
    }),
    ...Object.values(DocumentAttributePostfixes).flatMap((postfix) => [
      createIndexedNestedAttributePath({
        listRootPath: SemanticConventions.RETRIEVAL_DOCUMENTS,
        itemPathSegments: [
          SemanticAttributePrefixes.document,
          ...semanticConventionPathToSegments(postfix),
        ],
      }),
      createIndexedNestedAttributePath({
        listRootPath: SemanticConventions.RERANKER_INPUT_DOCUMENTS,
        itemPathSegments: [
          SemanticAttributePrefixes.document,
          ...semanticConventionPathToSegments(postfix),
        ],
      }),
      createIndexedNestedAttributePath({
        listRootPath: SemanticConventions.RERANKER_OUTPUT_DOCUMENTS,
        itemPathSegments: [
          SemanticAttributePrefixes.document,
          ...semanticConventionPathToSegments(postfix),
        ],
      }),
    ]),
    ...[
      EmbeddingAttributePostfixes.text,
      EmbeddingAttributePostfixes.vector,
    ].map((postfix) =>
      createIndexedNestedAttributePath({
        listRootPath: SemanticConventions.EMBEDDING_EMBEDDINGS,
        itemPathSegments: [
          SemanticAttributePrefixes.embedding,
          ...semanticConventionPathToSegments(postfix),
        ],
      })
    ),
  ];

/**
 * Escapes a path segment for the single-quoted subscript form used by inserted
 * completions.
 */
function escapeAttributePathSegment(pathSegment: string): string {
  return pathSegment.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Reverses escaping for path segments matched from either single- or
 * double-quoted user input before re-emitting them in the canonical accessor
 * form.
 */
function unescapeAttributePathSegment(pathSegment: string): string {
  return pathSegment.replace(/\\(["'\\])/g, "$1");
}

/**
 * Converts a segment list into backend DSL subscript syntax. Bracket notation
 * is used for every string segment so completions always produce the same
 * filter shape as the backend attribute path parser expects.
 */
function attributePathSegmentsToAccessor(
  pathSegments: readonly AttributePathSegment[]
): string {
  return pathSegments
    .map((pathSegment) =>
      typeof pathSegment === "number"
        ? `[${pathSegment}]`
        : `['${escapeAttributePathSegment(pathSegment)}']`
    )
    .join("");
}

/**
 * Converts a dotted OpenInference path into the canonical Phoenix filter DSL
 * accessor, e.g. `llm.provider` becomes `attributes['llm']['provider']`.
 */
export function semanticConventionPathToAttributeAccessor(
  semanticConventionPath: string
): string {
  return `attributes${attributePathSegmentsToAccessor(
    semanticConventionPathToSegments(semanticConventionPath)
  )}`;
}

/**
 * Canonicalizes an accessor before comparing it to a value-completion config.
 * Users may type double quotes or escaped characters, but completion configs
 * use the single-quoted bracket form emitted by this module.
 */
export function normalizeOpenInferenceAttributeAccessor(
  accessor: string
): string {
  if (accessor === SPAN_KIND_FIELD) {
    return accessor;
  }
  if (!accessor.startsWith("attributes")) {
    return accessor;
  }

  const pathSegments: AttributePathSegment[] = [];
  for (const segmentMatch of accessor.matchAll(
    attributeAccessorSegmentPattern
  )) {
    const doubleQuotedPathSegment = segmentMatch[1];
    const singleQuotedPathSegment = segmentMatch[2];
    const indexPathSegment = segmentMatch[3];
    if (typeof indexPathSegment === "string") {
      pathSegments.push(Number(indexPathSegment));
      continue;
    }
    const pathSegment = doubleQuotedPathSegment ?? singleQuotedPathSegment;
    if (typeof pathSegment === "string") {
      pathSegments.push(unescapeAttributePathSegment(pathSegment));
    }
  }
  if (pathSegments.length === 0) {
    return accessor;
  }
  return `attributes${attributePathSegmentsToAccessor(pathSegments)}`;
}

/**
 * Creates field completions for OpenInference span attributes.
 *
 * Top-level semantic conventions are generated directly from the package enum,
 * excluding per-item postfix groups that are only meaningful below list roots.
 * Nested list conventions are provided separately so each one includes the
 * required numeric index in the suggested DSL accessor.
 */
export function createOpenInferenceAttributeCompletions({
  semanticConventions,
  nestedSemanticConventionAttributePaths,
  section = openInferenceAttributesSection,
}: {
  semanticConventions?: SemanticConventionMap;
  nestedSemanticConventionAttributePaths?: readonly SemanticConventionAttributePath[];
  section?: CompletionSection;
} = {}): Completion[] {
  const resolvedSemanticConventions =
    semanticConventions ?? DEFAULT_SEMANTIC_CONVENTIONS;
  const resolvedNestedSemanticConventionAttributePaths =
    nestedSemanticConventionAttributePaths ??
    (semanticConventions ? [] : defaultNestedSemanticConventionAttributePaths);
  const seenAccessors = new Set<string>();
  const topLevelSemanticConventionAttributePaths = Object.values(
    resolvedSemanticConventions
  )
    .filter(isTopLevelSemanticConventionPath)
    .map((semanticConventionPath) => ({
      pathSegments: semanticConventionPathToSegments(semanticConventionPath),
      detail: semanticConventionPath,
    }));

  return [
    ...topLevelSemanticConventionAttributePaths,
    ...resolvedNestedSemanticConventionAttributePaths,
  ]
    .sort((firstPath, secondPath) =>
      firstPath.detail.localeCompare(secondPath.detail)
    )
    .flatMap(({ pathSegments, detail }) => {
      const label = `attributes${attributePathSegmentsToAccessor(pathSegments)}`;
      if (seenAccessors.has(label)) {
        return [];
      }
      seenAccessors.add(label);
      return [
        {
          label,
          type: "variable",
          detail,
          info: `OpenInference semantic convention: ${detail}`,
          section,
        },
      ];
    });
}

/**
 * Enum-value completions for fields Phoenix can evaluate reliably. Note that
 * `openinference.span.kind` is intentionally omitted in favor of `span_kind`,
 * and nested-only conventions such as `audio.mime_type` are not offered as
 * value-completion roots.
 */
const defaultOpenInferenceAttributeValueCompletionConfigs = [
  {
    accessor: SPAN_KIND_FIELD,
    detail: "span kind",
    values: Object.values(OpenInferenceSpanKind),
  },
  {
    accessor: semanticConventionPathToAttributeAccessor(
      SemanticConventions.LLM_PROVIDER
    ),
    detail: "LLM provider",
    values: Object.values(LLMProvider),
  },
  {
    accessor: semanticConventionPathToAttributeAccessor(
      SemanticConventions.LLM_SYSTEM
    ),
    detail: "LLM system",
    values: Object.values(LLMSystem),
  },
  {
    accessor: semanticConventionPathToAttributeAccessor(
      SemanticConventions.INPUT_MIME_TYPE
    ),
    detail: "input MIME type",
    values: Object.values(MimeType),
  },
  {
    accessor: semanticConventionPathToAttributeAccessor(
      SemanticConventions.OUTPUT_MIME_TYPE
    ),
    detail: "output MIME type",
    values: Object.values(MimeType),
  },
] satisfies readonly OpenInferenceAttributeValueCompletionConfig[];

/**
 * Returns the enum-value completion context when the cursor is inside a quoted
 * right-hand-side literal for a supported comparison. The left boundary avoids
 * treating identifiers that merely end with a supported field name, such as
 * `my_span_kind`, as OpenInference fields.
 */
export function getOpenInferenceAttributeValueCompletionContext(
  textBeforeCursor: string
): OpenInferenceAttributeValueCompletionContext | null {
  const match = textBeforeCursor.match(attributeValueContextPattern);
  if (!match?.groups) {
    return null;
  }
  const quote = match.groups.quote;
  if (quote !== "'" && quote !== '"') {
    return null;
  }
  return {
    accessor: normalizeOpenInferenceAttributeAccessor(match.groups.accessor),
    quote,
    typedText: match.groups.typedText,
  };
}

/**
 * Finds how much of the current quoted value should be replaced. When the user
 * accepts a completion in the middle of an existing literal, the stale suffix
 * is removed up to the closing quote instead of being left behind.
 */
function getValueCompletionReplacementEnd({
  view,
  to,
  quote,
}: {
  view: EditorView;
  to: number;
  quote: "'" | '"';
}): { to: number; hasClosingQuote: boolean } {
  let isEscaped = false;
  for (let position = to; position < view.state.doc.length; position++) {
    const character = view.state.doc.sliceString(position, position + 1);
    if (isEscaped) {
      isEscaped = false;
      continue;
    }
    if (character === "\\") {
      isEscaped = true;
      continue;
    }
    if (character === quote) {
      return { to: position, hasClosingQuote: true };
    }
    if (character === "\n") {
      return { to: position, hasClosingQuote: false };
    }
  }
  return { to: view.state.doc.length, hasClosingQuote: false };
}

/**
 * Applies a value completion while preserving an existing closing quote or
 * inserting one when the user is completing an unterminated string.
 */
function createValueCompletionApply({
  quote,
}: {
  quote: "'" | '"';
}): Completion["apply"] {
  return (
    view: EditorView,
    completion: Completion,
    from: number,
    to: number
  ) => {
    const { to: replacementTo, hasClosingQuote } =
      getValueCompletionReplacementEnd({ view, to, quote });
    const insertion = hasClosingQuote
      ? completion.label
      : `${completion.label}${quote}`;
    view.dispatch({
      changes: { from, to: replacementTo, insert: insertion },
      selection: { anchor: from + completion.label.length + 1 },
    });
  };
}

/**
 * Creates CodeMirror completion items for the enum values of one OpenInference
 * attribute.
 */
function createValueCompletions({
  valueCompletionConfig,
  quote,
  section,
}: {
  valueCompletionConfig: OpenInferenceAttributeValueCompletionConfig;
  quote: "'" | '"';
  section: CompletionSection;
}): Completion[] {
  return valueCompletionConfig.values.map((value) => ({
    label: value,
    type: "constant",
    detail: valueCompletionConfig.detail,
    info: `OpenInference ${valueCompletionConfig.detail} value`,
    section,
    apply: createValueCompletionApply({ quote }),
  }));
}

/**
 * Builds the completion source that offers enum values after supported
 * OpenInference comparisons such as `span_kind == 'LL`.
 */
export function createOpenInferenceAttributeValueCompletionSource({
  valueCompletionConfigs = defaultOpenInferenceAttributeValueCompletionConfigs,
  section = openInferenceAttributeValuesSection,
}: {
  valueCompletionConfigs?: readonly OpenInferenceAttributeValueCompletionConfig[];
  section?: CompletionSection;
} = {}): CompletionSource {
  const valueCompletionConfigByAccessor = new Map(
    valueCompletionConfigs.map((valueCompletionConfig) => [
      normalizeOpenInferenceAttributeAccessor(valueCompletionConfig.accessor),
      valueCompletionConfig,
    ])
  );

  return (context: CompletionContext): CompletionResult | null => {
    const textBeforeCursor = context.state.doc.sliceString(0, context.pos);
    const valueCompletionContext =
      getOpenInferenceAttributeValueCompletionContext(textBeforeCursor);
    if (!valueCompletionContext) {
      return null;
    }

    const valueCompletionConfig = valueCompletionConfigByAccessor.get(
      valueCompletionContext.accessor
    );
    if (!valueCompletionConfig) {
      return null;
    }

    return {
      from: context.pos - valueCompletionContext.typedText.length,
      options: createValueCompletions({
        valueCompletionConfig,
        quote: valueCompletionContext.quote,
        section,
      }),
      validFor: /^[^'"]*$/,
    };
  };
}

/**
 * Default OpenInference field completions used by the span filter DSL editor.
 */
export const openInferenceAttributeCompletions =
  createOpenInferenceAttributeCompletions();

/**
 * Default OpenInference enum-value completion source used by the span filter
 * DSL editor.
 */
export const openInferenceAttributeValueCompletionSource =
  createOpenInferenceAttributeValueCompletionSource();
