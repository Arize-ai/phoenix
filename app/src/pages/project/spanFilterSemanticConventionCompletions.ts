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

type SemanticConventionMap = Readonly<Record<string, string>>;
type AttributePathSegment = string | number;

type OpenInferenceAttributeValueCompletionConfig = {
  accessor: string;
  detail: string;
  values: readonly string[];
};

type OpenInferenceAttributeValueCompletionContext = {
  accessor: string;
  quote: "'" | '"';
  typedText: string;
};

type SemanticConventionAttributePath = {
  pathSegments: readonly AttributePathSegment[];
  detail: string;
};

const DEFAULT_SEMANTIC_CONVENTIONS: SemanticConventionMap = SemanticConventions;
const SPAN_KIND_FIELD = "span_kind";
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

const hiddenTopLevelSemanticConventionPaths = new Set<string>([
  SemanticConventions.METADATA,
  SemanticConventions.OPENINFERENCE_SPAN_KIND,
]);

function isTopLevelSemanticConventionPath(
  semanticConventionPath: string
): boolean {
  return (
    !hiddenTopLevelSemanticConventionPaths.has(semanticConventionPath) &&
    !nestedOnlySemanticConventionPaths.has(semanticConventionPath)
  );
}

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

function escapeAttributePathSegment(pathSegment: string): string {
  return pathSegment.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function unescapeAttributePathSegment(pathSegment: string): string {
  return pathSegment.replace(/\\(["'\\])/g, "$1");
}

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

export function semanticConventionPathToAttributeAccessor(
  semanticConventionPath: string
): string {
  return `attributes${attributePathSegmentsToAccessor(
    semanticConventionPathToSegments(semanticConventionPath)
  )}`;
}

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

export const openInferenceAttributeCompletions =
  createOpenInferenceAttributeCompletions();
export const openInferenceAttributeValueCompletionSource =
  createOpenInferenceAttributeValueCompletionSource();
