/**
 * Builds a Relay ConcreteRequest (normalization AST + reader fragment +
 * params) at RUNTIME from only the GraphQL query text and the JSON response
 * data. No schema, no relay-compiler artifacts. This lets the client commit
 * server-side GraphQL execution results (streamed over the agent chat data
 * stream) into the Relay store generically.
 *
 * How field kinds are decided:
 *   - A field WITH a selection set in the query AST  -> LinkedField
 *     (this is decidable from the query alone; valid GraphQL requires
 *      selection sets on composite types and forbids them on scalars/enums)
 *   - A field WITHOUT a selection set                -> ScalarField
 *   - `plural` on a LinkedField is inferred from the RESPONSE: the value
 *     (in any of the sampled parent objects) is an array.
 *
 * The response is only strictly needed for:
 *   - plural inference
 *   - deciding whether a fragment type condition matched the concrete
 *     __typename at that position (unions/interfaces without a schema)
 *   - resolving registered @connection handles per observed parent typename.
 *
 * The server guarantees `id` and `__typename` are injected into every
 * selection set, so records normalize under stable ids and type refinements
 * can be resolved against observed typenames.
 */

import { Kind, parse } from "graphql";
import type {
  FieldNode,
  FragmentDefinitionNode,
  SelectionSetNode,
  ValueNode,
} from "graphql";
import type { ConcreteRequest } from "relay-runtime";

import type { AgentConnectionEntry } from "./connectionRegistry";

/** A (possibly nested) object sampled from the GraphQL response. */
type ResponseObject = Record<string, unknown>;

type ResolveConnectionsFn = (
  parentTypename: string,
  fieldName: string
) => AgentConnectionEntry[];

// ---------------------------------------------------------------------------
// Runtime AST node shapes
// ---------------------------------------------------------------------------
// These mirror the plain-object nodes relay-compiler emits into
// __generated__/*.graphql.ts artifacts. relay-runtime consumes them as data
// (there are no classes to instantiate), so hand-building them is safe as
// long as the shapes match what the normalizer/reader switch on.

type RuntimeArgument =
  | { kind: "Literal"; name: string; value: unknown }
  | { kind: "Variable"; name: string; variableName: string }
  | { kind: "ObjectValue"; name: string; fields: RuntimeArgument[] }
  | { kind: "ListValue"; name: string; items: RuntimeArgument[] };

type RuntimeScalarField = {
  alias: string | null;
  args: RuntimeArgument[] | null;
  kind: "ScalarField";
  name: string;
  storageKey: string | null;
};

type RuntimeLinkedField = {
  alias: string | null;
  args: RuntimeArgument[] | null;
  concreteType: null;
  kind: "LinkedField";
  name: string;
  plural: boolean;
  selections: RuntimeSelection[];
  storageKey: string | null;
};

type RuntimeInlineFragment = {
  kind: "InlineFragment";
  selections: RuntimeSelection[];
  type: string;
  abstractKey: null;
};

/**
 * Normalization-only handle instructing the store to run ConnectionHandler
 * after writing the field. Shape copied from a compiled artifact
 * (app/src/components/dataset/__generated__/DatasetSelectQuery.graphql.ts).
 */
type RuntimeLinkedHandle = {
  alias: string | null;
  args: RuntimeArgument[] | null;
  filters: readonly string[] | null;
  handle: "connection";
  key: string;
  kind: "LinkedHandle";
  name: string;
};

type RuntimeSelection =
  | RuntimeScalarField
  | RuntimeLinkedField
  | RuntimeInlineFragment
  | RuntimeLinkedHandle;

type BuildContext = {
  /** Fragment definitions from the same document, by name. */
  fragmentDefs: Partial<Record<string, FragmentDefinitionNode>>;
  /**
   * Present only for the operation (normalization) pass. LinkedHandle nodes
   * must not appear in the reader fragment: RelayReader has no case for them
   * and throws `Unexpected ast kind`, and compiled artifacts likewise emit
   * them only under `operation`.
   */
  resolveConnections?: ResolveConnectionsFn;
};

// ---------------------------------------------------------------------------
// Argument nodes
// ---------------------------------------------------------------------------

function compareByName(
  first: { name: string },
  second: { name: string }
): number {
  return first.name < second.name ? -1 : first.name > second.name ? 1 : 0;
}

/** Whether a graphql-js ValueNode contains a variable anywhere within it. */
function valueNodeContainsVariable(valueNode: ValueNode): boolean {
  switch (valueNode.kind) {
    case Kind.VARIABLE:
      return true;
    case Kind.LIST:
      return valueNode.values.some(valueNodeContainsVariable);
    case Kind.OBJECT:
      return valueNode.fields.some((field) =>
        valueNodeContainsVariable(field.value)
      );
    default:
      return false;
  }
}

/** Like graphql's valueFromASTUntyped but local so we control enum handling. */
function literalValue(valueNode: ValueNode): unknown {
  switch (valueNode.kind) {
    case Kind.NULL:
      return null;
    case Kind.INT:
      return parseInt(valueNode.value, 10);
    case Kind.FLOAT:
      return parseFloat(valueNode.value);
    case Kind.STRING:
    case Kind.ENUM: // relay-compiler also emits enum literals as strings
    case Kind.BOOLEAN:
      return valueNode.value;
    case Kind.LIST:
      return valueNode.values.map(literalValue);
    case Kind.OBJECT: {
      // Sort keys: formatStorageKey JSON.stringifies Literal values as-is
      // (RelayStoreUtils.js getArgumentValue), while variable values go
      // through stableCopy (sorted keys). Sorting here keeps literal object
      // args' storage keys stable and identical to relay-compiler output.
      const sortedFields = [...valueNode.fields].sort((first, second) =>
        compareByName({ name: first.name.value }, { name: second.name.value })
      );
      const objectValue: ResponseObject = {};
      for (const field of sortedFields) {
        objectValue[field.name.value] = literalValue(field.value);
      }
      return objectValue;
    }
    default:
      throw new Error(`Unexpected literal value kind ${valueNode.kind}`);
  }
}

/** Build a Relay Argument node (Literal | Variable | ObjectValue | ListValue). */
function buildArgument(name: string, valueNode: ValueNode): RuntimeArgument {
  if (valueNode.kind === Kind.VARIABLE) {
    return { kind: "Variable", name, variableName: valueNode.name.value };
  }
  if (!valueNodeContainsVariable(valueNode)) {
    return { kind: "Literal", name, value: literalValue(valueNode) };
  }
  // Composite value containing at least one nested variable.
  if (valueNode.kind === Kind.OBJECT) {
    return {
      kind: "ObjectValue",
      name,
      fields: valueNode.fields
        .map((field) => buildArgument(field.name.value, field.value))
        .sort(compareByName),
    };
  }
  if (valueNode.kind === Kind.LIST) {
    return {
      kind: "ListValue",
      name,
      items: valueNode.values.map((itemNode, itemIndex) =>
        buildArgument(`${name}.${itemIndex}`, itemNode)
      ),
    };
  }
  throw new Error(`Cannot build argument for value kind ${valueNode.kind}`);
}

/**
 * Build the sorted args array for a field.
 * relay-compiler sorts arguments alphabetically by name; formatStorageKey
 * (relay-runtime/lib/store/RelayStoreUtils.js) serializes them in args-array
 * order, so sorting here makes our storage keys byte-identical to compiled
 * artifacts, e.g. `projects(first:2,orderBy:"NAME")`.
 */
function buildArgs(fieldNode: FieldNode): RuntimeArgument[] | null {
  const argumentNodes = fieldNode.arguments ?? [];
  if (argumentNodes.length === 0) {
    return null;
  }
  return argumentNodes
    .map((argumentNode) =>
      buildArgument(argumentNode.name.value, argumentNode.value)
    )
    .sort(compareByName);
}

/** Precompute storageKey when every arg is a Literal (mirrors relay-compiler). */
function maybeStorageKey(
  name: string,
  args: RuntimeArgument[] | null
): string | undefined {
  if (!args || args.length === 0) {
    return undefined;
  }
  const literalArgs: Array<{ name: string; value: unknown }> = [];
  for (const arg of args) {
    if (arg.kind !== "Literal") {
      return undefined;
    }
    literalArgs.push(arg);
  }
  const parts = literalArgs
    .filter((arg) => arg.value != null)
    .map((arg) => `${arg.name}:${JSON.stringify(arg.value)}`);
  return parts.length === 0 ? name : `${name}(${parts.join(",")})`;
}

// ---------------------------------------------------------------------------
// Selection building (walked in tandem with response data)
// ---------------------------------------------------------------------------

/** Non-null objects (per `typeof`) qualify as samples, exactly as the PoC. */
function isSampleObject(value: unknown): value is ResponseObject {
  return typeof value === "object" && value !== null;
}

/**
 * The distinct `__typename` strings observed on the samples; falls back to
 * the enclosing level's typenames when no sample carries one (e.g. the root
 * response object, which has no `__typename` selection of its own).
 */
function deriveObservedTypenames(
  samples: readonly ResponseObject[],
  fallback: readonly string[]
): readonly string[] {
  const observed: string[] = [];
  for (const sample of samples) {
    const typename = sample.__typename;
    if (typeof typename === "string" && !observed.includes(typename)) {
      observed.push(typename);
    }
  }
  return observed.length > 0 ? observed : fallback;
}

/** All response keys (alias or name) a selection set could produce. */
function responseKeysOfSelectionSet(
  selectionSet: SelectionSetNode,
  fragmentDefs: BuildContext["fragmentDefs"]
): string[] {
  const keys: string[] = [];
  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      keys.push(selection.alias ? selection.alias.value : selection.name.value);
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      keys.push(
        ...responseKeysOfSelectionSet(selection.selectionSet, fragmentDefs)
      );
    } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const definition = fragmentDefs[selection.name.value];
      if (definition) {
        keys.push(
          ...responseKeysOfSelectionSet(definition.selectionSet, fragmentDefs)
        );
      }
    }
  }
  return keys;
}

/**
 * @param selectionSet - graphql-js SelectionSetNode
 * @param samples - array of non-null response objects at this position
 *   (multiple when the parent field is plural)
 * @param parentTypenames - the observed `__typename`(s) of the records owning
 *   this selection set ("Query"/"Mutation" at the root)
 * @param context - fragment definitions and optional connection resolution
 */
function buildSelections(
  selectionSet: SelectionSetNode,
  samples: readonly ResponseObject[],
  parentTypenames: readonly string[],
  context: BuildContext
): RuntimeSelection[] {
  const selections: RuntimeSelection[] = [];
  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      selections.push(
        ...buildField(selection, samples, parentTypenames, context)
      );
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      const typeCondition = selection.typeCondition
        ? selection.typeCondition.name.value
        : null;
      selections.push(
        ...buildTypeConditioned(
          typeCondition,
          selection.selectionSet,
          samples,
          parentTypenames,
          context
        )
      );
    } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const definition = context.fragmentDefs[selection.name.value];
      if (!definition) {
        throw new Error(
          `Fragment ${selection.name.value} not defined in the same document; ` +
            `cannot inline it without its definition.`
        );
      }
      selections.push(
        ...buildTypeConditioned(
          definition.typeCondition.name.value,
          definition.selectionSet,
          samples,
          parentTypenames,
          context
        )
      );
    }
  }
  return selections;
}

/**
 * Handle `... on T { ... }` / spreads of fragments on T, without a schema.
 *  1. If some sample has __typename === T -> concrete InlineFragment keyed on
 *     that type (the normalizer/reader compare record type to `type` when
 *     abstractKey == null; RelayResponseNormalizer.js ~line 136).
 *  2. Else if the fragment's fields are actually present in the data, T must
 *     be an interface the concrete type implements (the server executed the
 *     query and returned those fields), so HOIST the selections into the
 *     parent (equivalent to an always-matching refinement for this payload).
 *  3. Else emit a concrete InlineFragment on T built from no samples; it
 *     will simply never match this payload's records (union non-match case).
 */
function buildTypeConditioned(
  typeCondition: string | null,
  selectionSet: SelectionSetNode,
  samples: readonly ResponseObject[],
  parentTypenames: readonly string[],
  context: BuildContext
): RuntimeSelection[] {
  if (typeCondition == null) {
    // `... { a b }` without type condition: transparent.
    return buildSelections(selectionSet, samples, parentTypenames, context);
  }
  const matching = samples.filter(
    (sample) => sample.__typename === typeCondition
  );
  if (matching.length > 0) {
    return [
      {
        kind: "InlineFragment",
        selections: buildSelections(
          selectionSet,
          matching,
          [typeCondition],
          context
        ),
        type: typeCondition,
        abstractKey: null,
      },
    ];
  }
  const responseKeys = responseKeysOfSelectionSet(
    selectionSet,
    context.fragmentDefs
  );
  const present = samples.filter((sample) =>
    responseKeys.some((responseKey) =>
      Object.prototype.hasOwnProperty.call(sample, responseKey)
    )
  );
  if (present.length > 0) {
    // Interface/abstract condition matched by the server: hoist.
    return buildSelections(
      selectionSet,
      present,
      deriveObservedTypenames(present, parentTypenames),
      context
    );
  }
  return [
    {
      kind: "InlineFragment",
      selections: buildSelections(selectionSet, [], [typeCondition], context),
      type: typeCondition,
      abstractKey: null,
    },
  ];
}

/**
 * Build the node(s) for one field selection: the ScalarField/LinkedField
 * itself, followed by any LinkedHandle siblings for registered @connection
 * declarations reading this field (normalization pass only). Compiled
 * artifacts emit connection handles the same way: a LinkedHandle sibling
 * immediately after the LinkedField, sharing its args.
 */
function buildField(
  fieldNode: FieldNode,
  samples: readonly ResponseObject[],
  parentTypenames: readonly string[],
  context: BuildContext
): RuntimeSelection[] {
  const name = fieldNode.name.value;
  const alias = fieldNode.alias ? fieldNode.alias.value : null;
  const responseKey = alias ?? name;
  const args = buildArgs(fieldNode);
  const storageKey = maybeStorageKey(name, args);

  if (!fieldNode.selectionSet) {
    // Scalar/enum leaf (decided by the query AST alone). Note: custom JSON
    // scalars that return objects are still correctly ScalarFields here.
    return [
      {
        alias,
        args,
        kind: "ScalarField",
        name,
        storageKey: storageKey ?? null,
      },
    ];
  }

  // Linked field. Gather child objects from every sample to infer plurality
  // and to give union/interface handling a full picture.
  const values = samples
    .map((sample) => sample[responseKey])
    .filter((value) => value !== undefined);
  const isPlural = values.some((value) => Array.isArray(value));
  const childSamples: ResponseObject[] = [];
  for (const value of values) {
    if (value == null) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isSampleObject(item)) {
          childSamples.push(item);
        }
      }
    } else if (isSampleObject(value)) {
      childSamples.push(value);
    }
  }
  // NULL-VALUE GOTCHA: if every value is null/undefined we cannot see the
  // shape, but the query AST already told us it is a LinkedField; `plural`
  // defaults to false, which is harmless because the normalizer writes null
  // without consulting `plural` (RelayResponseNormalizer.js _normalizeField).

  const linkedField: RuntimeLinkedField = {
    alias,
    args,
    // concreteType is an optimization the compiler fills from the schema.
    // null is always safe: the normalizer falls back to data.__typename
    // (RelayResponseNormalizer.js _getRecordType), which we require present.
    concreteType: null,
    kind: "LinkedField",
    name,
    plural: isPlural,
    selections: buildSelections(
      fieldNode.selectionSet,
      childSamples,
      deriveObservedTypenames(childSamples, []),
      context
    ),
    storageKey: storageKey ?? null,
  };

  const resolveConnections = context.resolveConnections;
  if (!resolveConnections) {
    return [linkedField];
  }
  // Emit one LinkedHandle per registered connection reading this field. When
  // sampled parents have different __typenames, resolve per observed typename
  // and union the entries, deduped by connection key.
  const seenConnectionKeys = new Set<string>();
  const handles: RuntimeLinkedHandle[] = [];
  for (const parentTypename of parentTypenames) {
    for (const entry of resolveConnections(parentTypename, name)) {
      if (seenConnectionKeys.has(entry.key)) {
        continue;
      }
      seenConnectionKeys.add(entry.key);
      handles.push({
        alias,
        args,
        filters: entry.filters,
        handle: "connection",
        key: entry.key,
        kind: "LinkedHandle",
        name,
      });
    }
  }
  return [linkedField, ...handles];
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * FNV-1a 32-bit hash, hex-encoded. Deterministic (no Date/Math.random) so the
 * same query text always yields the same request cacheID, which is what Relay
 * uses to identify the request (getRequestIdentifier requires cacheID or id).
 */
function hashQueryText(queryText: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < queryText.length; index++) {
    hash ^= queryText.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  // >>> 0 reinterprets the signed 32-bit result as unsigned before hex.
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Build a Relay ConcreteRequest at runtime from a GraphQL operation's text and
 * its response data, usable with createOperationDescriptor/commitPayload/
 * lookup/subscribe/retain.
 *
 * @param options - build inputs
 * @param options.queryText - GraphQL operation text (may include fragment
 *   definitions; spreads are inlined from the same document)
 * @param options.data - the GraphQL response's `data` object for `queryText`
 * @param options.operationKind - whether the operation is a query or mutation
 * @param options.resolveConnections - optional lookup of registered
 *   `@connection` declarations by (parentTypename, fieldName); matching
 *   LinkedFields get LinkedHandle siblings in the normalization AST so
 *   ConnectionHandler maintains the client connection records
 */
export function buildConcreteRequest({
  queryText,
  data,
  operationKind,
  resolveConnections,
}: {
  queryText: string;
  data: Record<string, unknown>;
  operationKind: "query" | "mutation";
  resolveConnections?: ResolveConnectionsFn;
}): ConcreteRequest {
  const document = parse(queryText);
  const operations = document.definitions.filter(
    (definition) => definition.kind === Kind.OPERATION_DEFINITION
  );
  if (operations.length !== 1) {
    throw new Error(`Expected exactly one operation, got ${operations.length}`);
  }
  const operationDefinition = operations[0];
  const fragmentDefs: BuildContext["fragmentDefs"] = {};
  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragmentDefs[definition.name.value] = definition;
    }
  }

  const name = operationDefinition.name
    ? operationDefinition.name.value
    : "AnonymousOperation";

  // Operation variable definitions -> LocalArgument defs (sorted, as the
  // compiler emits them). getOperationVariables reads name + defaultValue
  // (relay-runtime/lib/store/RelayConcreteVariables.js).
  const argumentDefinitions = (operationDefinition.variableDefinitions ?? [])
    .map((variableDefinition) => ({
      defaultValue: variableDefinition.defaultValue
        ? literalValue(variableDefinition.defaultValue)
        : null,
      kind: "LocalArgument" as const,
      name: variableDefinition.variable.name.value,
    }))
    .sort(compareByName);

  const rootSamples: ResponseObject[] = [data];

  // Root type name for the reader fragment. RelayReader special-cases the
  // ROOT_ID record so the exact string does not gate reads at the root
  // (RelayReader.js _recordMatchesTypeCondition: `|| dataID === ROOT_ID`).
  const rootTypename = operationKind === "mutation" ? "Mutation" : "Query";

  // Two passes over the same document: the normalization AST carries
  // LinkedHandle nodes for registered connections, while the reader fragment
  // must not (RelayReader throws on unknown kinds; compiled artifacts also
  // emit LinkedHandle only under `operation`). Both passes are deterministic
  // walks of the same AST + samples, so the field selections are identical.
  const operationSelections = buildSelections(
    operationDefinition.selectionSet,
    rootSamples,
    [rootTypename],
    { fragmentDefs, resolveConnections }
  );
  const fragmentSelections = resolveConnections
    ? buildSelections(
        operationDefinition.selectionSet,
        rootSamples,
        [rootTypename],
        { fragmentDefs }
      )
    : operationSelections;

  // Reader fragment: same node shapes work for RelayReader (ScalarField/
  // LinkedField/InlineFragment are read-compatible); we inline all spreads
  // so no ReaderFragmentSpread nodes are needed.
  const fragment = {
    argumentDefinitions,
    kind: "Fragment" as const,
    metadata: null,
    name,
    selections: fragmentSelections,
    type: rootTypename,
    abstractKey: null,
  };

  const operation = {
    argumentDefinitions,
    kind: "Operation" as const,
    name,
    selections: operationSelections,
  };

  // params: getRequestIdentifier (relay-runtime/lib/util/getRequestIdentifier.js)
  // requires cacheID or id to be non-null; everything else is metadata.
  const params = {
    cacheID: hashQueryText(queryText),
    id: null,
    metadata: {},
    name,
    operationKind,
    text: queryText,
  };

  const request = {
    fragment,
    kind: "Request" as const,
    operation,
    params,
  };

  // The runtime AST is intentionally hand-built plain data. relay-runtime
  // consumes ConcreteRequest structurally (switching on `kind` strings), and
  // @types/relay-runtime's ConcreteRequest models the compiler's richer node
  // unions which this builder never emits, so a structural assignment cannot
  // typecheck; cast once at the boundary instead.
  return request as unknown as ConcreteRequest;
}
