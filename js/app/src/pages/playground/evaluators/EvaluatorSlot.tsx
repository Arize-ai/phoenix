import type { ReactNode } from "react";
import {
  Suspense,
  useDeferredValue,
  useEffect,
  useState,
  useTransition,
} from "react";
import { graphql, useLazyLoadQuery, useQueryLoader } from "react-relay";

import {
  Alert,
  Button,
  DebouncedSearch,
  Dialog,
  Flex,
  Icon,
  IconButton,
  Icons,
  ListBox,
  Loading,
  Modal,
  ModalOverlay,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import { AlphabeticIndexIcon } from "@phoenix/components/AlphabeticIndexIcon";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@phoenix/components/core/dialog";
import EvaluatorProviderQueryNode, {
  type EvaluatorPlaygroundProviderQuery,
} from "@phoenix/components/evaluators/__generated__/EvaluatorPlaygroundProviderQuery.graphql";
import { EvaluatorKindToken } from "@phoenix/components/evaluators/EvaluatorKindToken";
import { EvaluatorPlaygroundProvider } from "@phoenix/components/evaluators/EvaluatorPlaygroundProvider";
import ModelMenuQueryNode, {
  type useModelMenuDataQuery,
} from "@phoenix/components/generative/__generated__/useModelMenuDataQuery.graphql";
import { ModelMenuFetchPolicyContext } from "@phoenix/components/generative/useModelMenuData";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import {
  DEFAULT_LLM_EVALUATOR_STORE_VALUES,
  type AnnotationConfig,
  type EvaluatorStoreProps,
} from "@phoenix/store/evaluatorStore";

import type { EvaluatorSlotQuery } from "./__generated__/EvaluatorSlotQuery.graphql";
import type { EvaluatorSlotSourceQuery } from "./__generated__/EvaluatorSlotSourceQuery.graphql";
import type { EvaluatorSaveTarget } from "./evaluatorSaveTarget";
import { getEvaluatorSaveTarget } from "./evaluatorSaveTarget";
import { EvaluatorSlotEditor } from "./EvaluatorSlotEditor";
import type { EvaluatorSlotProps } from "./evaluatorSlotTypes";
import { getSlotIndex } from "./evaluatorSlotTypes";
import { getSlotSourceLabel } from "./evaluatorSlotValidation";

export function EvaluatorSlot(props: EvaluatorSlotProps) {
  const initialSelection =
    props.initialDatasetEvaluatorId ?? props.initialEvaluatorId ?? "new-llm";

  return <EvaluatorSlotContent key={initialSelection} {...props} />;
}

function EvaluatorSlotContent(props: EvaluatorSlotProps) {
  const [selection, setSelection] = useState(
    props.initialDatasetEvaluatorId ?? props.initialEvaluatorId ?? "new-llm"
  );

  // Bumped on every (re)selection so choosing the source already loaded — the
  // reset button does exactly that — still remounts a fresh editor.
  const [generation, setGeneration] = useState(0);
  const [sourceName, setSourceName] = useState("Loading evaluator…");
  const [kind, setKind] = useState<"LLM" | "CODE">("LLM");
  const [isDirty, setIsDirty] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);

  function selectSource(id: string) {
    setIsDirty(false);
    setPendingSelection(null);
    setSelection(id);
    setGeneration((current) => current + 1);
    props.onSelectionChange?.({ evaluatorId: id, datasetEvaluatorId: null });
  }

  function requestSource(id: string) {
    if (isDirty) setPendingSelection(id);
    else selectSource(id);
  }

  const freshSource = kind === "CODE" ? "new-code" : "new-llm";

  const sourceControl = (
    <Flex direction="row" gap="size-100" alignItems="center" minWidth={0}>
      <View flex="none">
        <AlphabeticIndexIcon index={getSlotIndex(props.slotId)} />
      </View>
      <Suspense fallback={<Loading size="S" />}>
        <EvaluatorSlotPicker
          selection={selection}
          sourceName={sourceName}
          onSelectionChange={(id) => {
            if (id !== selection) requestSource(id);
          }}
        />
      </Suspense>
      {/* Start over in the same kind without hunting for the "New…" entry in
          the picker. Reuses the picker's discard confirmation when the draft
          has changes. */}
      <TooltipTrigger>
        <IconButton
          size="S"
          aria-label={`Reset evaluator ${props.slotId} to a new ${
            kind === "CODE" ? "code" : "LLM"
          } evaluator`}
          isDisabled={props.isRunning}
          onPress={() => requestSource(freshSource)}
        >
          <Icon svg={<Icons.RotateCcw />} />
        </IconButton>
        <Tooltip>
          <TooltipArrow />
          Reset to a new {kind === "CODE" ? "code" : "LLM"} evaluator
        </Tooltip>
      </TooltipTrigger>
    </Flex>
  );

  return (
    <Flex direction="column" height="100%" minHeight={0}>
      <Suspense fallback={<Loading size="S" />}>
        <EvaluatorSlotSource
          key={`${selection}:${generation}`}
          {...props}
          selection={selection}
          sourceControl={sourceControl}
          onChange={(snapshot) => {
            setIsDirty(snapshot.isDirty);
            setSourceName(snapshot.name);
            setKind(snapshot.kind);
            props.onChange(snapshot);
          }}
        />
      </Suspense>
      <ModalOverlay
        isOpen={pendingSelection !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPendingSelection(null);
        }}
      >
        <Modal size="S">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Discard evaluator changes</DialogTitle>
              </DialogHeader>
              <View padding="size-200">
                <Text>
                  This replaces the unsaved draft in evaluator {props.slotId}.
                  This cannot be undone.
                </Text>
              </View>
              <DialogFooter>
                <Button
                  variant="default"
                  onPress={() => setPendingSelection(null)}
                >
                  Keep editing
                </Button>
                <Button
                  variant="danger"
                  onPress={() => {
                    if (pendingSelection) selectSource(pendingSelection);
                  }}
                >
                  Discard changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </Flex>
  );
}

function EvaluatorSlotPicker({
  selection,
  sourceName,
  onSelectionChange,
}: {
  selection: string;
  sourceName: string;
  onSelectionChange: (id: string) => void;
}) {
  const [hasOpened, setHasOpened] = useState(false);
  const [isLoadingOptions, startLoadingOptions] = useTransition();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const data = useLazyLoadQuery<EvaluatorSlotQuery>(
    graphql`
      query EvaluatorSlotQuery($filter: EvaluatorFilter, $hasOpened: Boolean!) {
        evaluators(first: 50, filter: $filter) @include(if: $hasOpened) {
          edges {
            node {
              id
              name
              kind
              isBuiltin
            }
          }
        }
      }
    `,
    {
      hasOpened,
      filter: deferredSearch ? { col: "name", value: deferredSearch } : null,
    }
  );

  const options = (data.evaluators?.edges ?? [])
    .map(({ node }) => node)
    .filter(
      (node) => !node.isBuiltin && (node.kind === "LLM" || node.kind === "CODE")
    );

  return (
    <Select
      aria-label="Evaluator"
      onOpenChange={(isOpen) => {
        if (isOpen) startLoadingOptions(() => setHasOpened(true));
      }}
      style={{ minWidth: 0, maxWidth: "100%" }}
      size="S"
      value={selection}
      onChange={(key) => {
        if (key != null) onSelectionChange(String(key));
      }}
    >
      <Button>
        <SelectValue>
          {getSlotSourceLabel({ selection, sourceName, options })}
        </SelectValue>
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <View padding="size-100">
          <DebouncedSearch
            aria-label="Search evaluators"
            defaultValue={search}
            onChange={setSearch}
            placeholder="Search evaluators"
          />
        </View>
        {isLoadingOptions ? <Loading size="S" /> : null}
        <ListBox>
          <SelectItem id="new-llm" textValue="New LLM evaluator">
            <Flex direction="row" gap="size-100" alignItems="center">
              <Icon svg={<Icons.PlusCircle />} />
              <Text>New LLM evaluator</Text>
            </Flex>
          </SelectItem>
          <SelectItem id="new-code" textValue="New code evaluator">
            <Flex direction="row" gap="size-100" alignItems="center">
              <Icon svg={<Icons.PlusCircle />} />
              <Text>New code evaluator</Text>
            </Flex>
          </SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} id={option.id} textValue={option.name}>
              <Flex
                direction="row"
                gap="size-100"
                alignItems="center"
                justifyContent="space-between"
              >
                <Text>{option.name}</Text>
                <EvaluatorKindToken kind={option.kind} size="S" />
              </Flex>
            </SelectItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}

function EvaluatorSlotSource(
  props: EvaluatorSlotProps & { selection: string; sourceControl: ReactNode }
) {
  const isNew = props.selection === "new-llm" || props.selection === "new-code";

  const data = useLazyLoadQuery<EvaluatorSlotSourceQuery>(
    graphql`
      query EvaluatorSlotSourceQuery($id: ID!, $hasSource: Boolean!) {
        node(id: $id) @include(if: $hasSource) {
          ... on Evaluator {
            ...EvaluatorSlot_source @relay(mask: false)
          }
          ... on DatasetEvaluator {
            ...EvaluatorSlot_datasetEvaluator @relay(mask: false)
          }
        }
      }
    `,
    { id: props.selection, hasSource: !isNew }
  );

  const source = data.node?.evaluator ?? data.node;

  if (!isNew && !isEditableSource(source))
    return (
      <EvaluatorSlotUnavailable
        selection={props.selection}
        onChange={props.onChange}
        sourceControl={props.sourceControl}
      />
    );

  const kind =
    source?.kind === "CODE" || props.selection === "new-code" ? "CODE" : "LLM";

  const initialState = createSlotInitialState({
    node: data.node,
    source,
    kind,
  });

  const saveTarget = resolveSaveTarget({
    node: data.node,
    source,
    datasetId: props.datasetId,
  });

  const editor = (
    <EvaluatorStoreProvider initialState={initialState}>
      <EvaluatorSlotEditor
        {...props}
        kind={kind}
        saveTarget={saveTarget}
        initialSourceCode={source?.sourceCode}
        initialLanguage={source?.language}
        initialSandboxConfigId={source?.sandboxConfig?.id}
      />
    </EvaluatorStoreProvider>
  );

  return kind === "CODE" ? (
    editor
  ) : (
    <EvaluatorSlotLLMProvider source={source}>
      {editor}
    </EvaluatorSlotLLMProvider>
  );
}

/** Reads the loaded node into the shape the save-target rule wants. */
function resolveSaveTarget({
  node,
  source,
  datasetId,
}: {
  node: EvaluatorSlotSourceQuery["response"]["node"];
  source: EvaluatorSlotSourceQuery["response"]["node"];
  datasetId: string | null;
}): EvaluatorSaveTarget {
  const isBinding = node?.evaluator != null;

  return getEvaluatorSaveTarget({
    datasetId,
    source:
      source?.id && source.kind
        ? {
            id: source.id,
            kind: source.kind,
            datasetEvaluators: source.datasetEvaluators ?? [],
          }
        : null,
    selectedDatasetEvaluator:
      isBinding && node.id && node.dataset
        ? { id: node.id, datasetId: node.dataset.id }
        : null,
  });
}

function createSlotInitialState({
  node,
  source,
  kind,
}: {
  node: EvaluatorSlotSourceQuery["response"]["node"];
  source: EvaluatorSlotSourceQuery["response"]["node"];
  kind: "LLM" | "CODE";
}): EvaluatorStoreProps {
  const outputConfigs: AnnotationConfig[] = (
    node?.outputConfigs ??
    source?.outputConfigs ??
    []
  ).flatMap((config): AnnotationConfig[] => {
    if (config.__typename === "CategoricalAnnotationConfig")
      return [
        {
          name: config.name,
          optimizationDirection: config.optimizationDirection,
          values: config.values.map((value) => ({
            label: value.label,
            score: value.score ?? undefined,
          })),
        },
      ];

    if (config.__typename === "ContinuousAnnotationConfig")
      return [
        {
          name: config.name,
          optimizationDirection: config.optimizationDirection,
          lowerBound: config.lowerBound,
          upperBound: config.upperBound,
        },
      ];

    if (config.__typename === "FreeformAnnotationConfig")
      return [
        {
          name: config.name,
          optimizationDirection: config.optimizationDirection,
          lowerBound: config.lowerBound,
          upperBound: config.upperBound,
          threshold: config.threshold,
        },
      ];

    return [];
  });

  return {
    ...DEFAULT_LLM_EVALUATOR_STORE_VALUES,
    evaluator: {
      ...DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator,
      kind,
      isBuiltin: false,
      globalName: source?.name ?? "",
      name: "",
      description: source?.description ?? "",
      inputMapping: node?.inputMapping ??
        source?.inputMapping ?? { literalMapping: {}, pathMapping: {} },
    },
    outputConfigs: outputConfigs.length
      ? outputConfigs
      : [
          {
            name: "result",
            optimizationDirection: "MAXIMIZE",
            values: [
              { label: "pass", score: 1 },
              { label: "fail", score: 0 },
            ],
          },
        ],
  } satisfies EvaluatorStoreProps;
}

export const evaluatorSlotSourceFragment = graphql`
  fragment EvaluatorSlot_source on Evaluator {
    id
    name
    description
    kind
    isBuiltin
    outputConfigs {
      ...EvaluatorSlot_output @relay(mask: false)
    }
    datasetEvaluators {
      id
      dataset {
        id
      }
    }
    ... on LLMEvaluator {
      prompt {
        id
        name
      }
      promptVersion {
        id
        templateFormat
        ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion
      }
      promptVersionTag {
        name
      }
    }
    ... on CodeEvaluator {
      language
      sourceCode
      sandboxConfig {
        id
      }
      inputMapping {
        literalMapping
        pathMapping
      }
    }
  }
`;

// Also returned by the slot's update mutations, so the Relay store holds what
// the slot would read back.
export const evaluatorSlotDatasetEvaluatorFragment = graphql`
  fragment EvaluatorSlot_datasetEvaluator on DatasetEvaluator {
    id
    name
    dataset {
      id
    }
    inputMapping {
      literalMapping
      pathMapping
    }
    outputConfigs {
      ...EvaluatorSlot_output @relay(mask: false)
    }
    evaluator {
      ...EvaluatorSlot_source @relay(mask: false)
    }
  }
`;

export const evaluatorSlotOutputFragment = graphql`
  fragment EvaluatorSlot_output on BuiltInEvaluatorOutputConfig {
    __typename
    ... on CategoricalAnnotationConfig {
      name
      optimizationDirection
      values {
        label
        score
      }
    }
    ... on ContinuousAnnotationConfig {
      name
      optimizationDirection
      lowerBound
      upperBound
    }
    ... on FreeformAnnotationConfig {
      name
      optimizationDirection
      threshold
      lowerBound
      upperBound
    }
  }
`;

function isEditableSource(
  source: EvaluatorSlotSourceQuery["response"]["node"]
): boolean {
  return (
    !!source?.id &&
    !source.isBuiltin &&
    (source.kind === "LLM" || source.kind === "CODE")
  );
}

function EvaluatorSlotUnavailable({
  selection,
  onChange,
  sourceControl,
}: {
  selection: string;
  onChange: EvaluatorSlotProps["onChange"];
  sourceControl: ReactNode;
}) {
  useEffect(
    () =>
      onChange({
        revision: `unavailable:${selection}`,
        isDirty: false,
        kind: "LLM",
        name: "Unavailable evaluator",
        outputNames: [],
        selectedOutputName: "",
        preview: null,
        inputMapping: { literalMapping: {}, pathMapping: {} },
        validationError: "The selected evaluator is unavailable.",
      }),
    [onChange, selection]
  );

  return (
    <Flex direction="column" gap="size-200">
      {sourceControl}
      <Alert variant="danger" title="Evaluator unavailable">
        This evaluator was deleted or cannot be edited here. Select another
        evaluator to continue.
      </Alert>
    </Flex>
  );
}

function EvaluatorSlotLLMProvider({
  source,
  children,
}: {
  source: EvaluatorSlotSourceQuery["response"]["node"];
  children: ReactNode;
}) {
  const [providerQuery, loadProviderQuery] =
    useQueryLoader<EvaluatorPlaygroundProviderQuery>(
      EvaluatorProviderQueryNode
    );

  const [modelQuery, loadModelQuery] =
    useQueryLoader<useModelMenuDataQuery>(ModelMenuQueryNode);

  useEffect(() => {
    // Neither catalog depends on the other. Start both before mounting the
    // provider/editor tree; useQueryLoader retains them until this slot unmounts.
    loadProviderQuery({});
    loadModelQuery({});
  }, [loadProviderQuery, loadModelQuery]);

  if (!providerQuery || !modelQuery) return <Loading size="S" />;

  return (
    <ModelMenuFetchPolicyContext value="store-or-network">
      <EvaluatorPlaygroundProvider
        promptId={source?.prompt?.id}
        promptName={source?.prompt?.name}
        promptVersionRef={source?.promptVersion}
        promptVersionTag={source?.promptVersionTag?.name}
        templateFormat={source?.promptVersion?.templateFormat}
      >
        {children}
      </EvaluatorPlaygroundProvider>
    </ModelMenuFetchPolicyContext>
  );
}
