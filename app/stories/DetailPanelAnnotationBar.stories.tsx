import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { Card, Flex, Text, View } from "@phoenix/components";
import type {
  AnnotationBarRow,
  AnnotationBarTarget,
} from "@phoenix/components/annotation/DetailPanelAnnotationBar";
import { DetailPanelAnnotationBar } from "@phoenix/components/annotation/DetailPanelAnnotationBar";
import type { Annotation } from "@phoenix/components/annotation/types";
import {
  TraceTree,
  TraceTreeProvider,
} from "@phoenix/components/trace/TraceTree";
import { traceTreePanelContentCSS } from "@phoenix/components/trace/traceTreeStyles";
import type { ISpanItem } from "@phoenix/components/trace/types";
import type { AnnotationConfig } from "@phoenix/pages/settings/types";

const ROW_ACTION_SPAN: ISpanItem = {
  id: "span-row",
  name: "retrieve_documents",
  spanKind: "retriever",
  statusCode: "OK",
  latencyMs: 125,
  startTime: "2026-07-29T16:00:00.000Z",
  endTime: "2026-07-29T16:00:00.125Z",
  parentId: null,
  spanId: "span-row-id",
  tokenCountTotal: null,
};

const PROJECT_NAME = "customer-support-agent";

const projectConfigs: AnnotationConfig[] = [
  {
    id: "config-correctness",
    name: "correctness",
    description: "Whether the response answers the request correctly.",
    annotationType: "CATEGORICAL",
    optimizationDirection: "MAXIMIZE",
    values: [
      { label: "correct", score: 1 },
      { label: "partially correct", score: 0.5 },
      { label: "incorrect", score: 0 },
    ],
  },
  {
    id: "config-confidence",
    name: "confidence",
    description: "Reviewer confidence from zero to one.",
    annotationType: "CONTINUOUS",
    optimizationDirection: "MAXIMIZE",
    lowerBound: 0,
    upperBound: 1,
  },
  {
    id: "config-observation",
    name: "observation",
    description: "Freeform reviewer feedback.",
    annotationType: "FREEFORM",
    optimizationDirection: "NONE",
  },
];

const inactiveConfigs: AnnotationConfig[] = [
  {
    id: "config-toxicity",
    name: "toxicity",
    description: "Whether the response contains harmful language.",
    annotationType: "CATEGORICAL",
    optimizationDirection: "MINIMIZE",
    values: [
      { label: "safe", score: 0 },
      { label: "borderline", score: 0.5 },
      { label: "toxic", score: 1 },
    ],
  },
  {
    id: "config-style",
    name: "style notes",
    description: "Unstructured comments about tone and writing style.",
    annotationType: "FREEFORM",
    optimizationDirection: "NONE",
  },
];

const initialTargets: AnnotationBarTarget[] = [
  {
    id: "session-1",
    kind: "session",
    label: "Session",
    annotations: [],
  },
  {
    id: "trace-1",
    kind: "trace",
    label: "Trace",
    annotations: [
      {
        id: "trace-correctness-1",
        name: "correctness",
        label: "correct",
        score: 1,
        explanation: "The trace arrived at the expected answer.",
      },
    ],
  },
  {
    id: "span-1",
    kind: "span",
    label: "This span",
    annotations: [
      {
        id: "span-correctness-1",
        name: "correctness",
        label: "correct",
        score: 1,
        explanation: "The retrieved evidence supports the answer.",
      },
      {
        id: "span-correctness-2",
        name: "correctness",
        label: "partially correct",
        score: 0.5,
        explanation: "One source was only indirectly relevant.",
      },
      {
        id: "span-confidence-1",
        name: "confidence",
        score: 0.78,
        explanation: "Strong evidence with a small ambiguity.",
      },
    ],
  },
];

function AnnotationBarDemo() {
  const [allConfigs, setAllConfigs] = useState<AnnotationConfig[]>([
    ...projectConfigs,
    ...inactiveConfigs,
  ]);
  const [activeConfigs, setActiveConfigs] =
    useState<AnnotationConfig[]>(projectConfigs);
  const [targets, setTargets] = useState<AnnotationBarTarget[]>(initialTargets);
  const getRows = (): AnnotationBarRow[] => [
    { id: "session-row", kind: "target", target: targets[0] },
    { id: "trace-row", kind: "target", target: targets[1] },
    { id: "nested-span-row", kind: "message", text: "Additional spans" },
    { id: "span-row", kind: "target", target: targets[2] },
  ];
  const updateTargetAnnotations = ({
    targetId,
    update,
  }: {
    targetId: string;
    update: (annotations: readonly Annotation[]) => Annotation[];
  }) => {
    setTargets((currentTargets) =>
      currentTargets.map((target) =>
        target.id === targetId
          ? { ...target, annotations: update(target.annotations) }
          : target
      )
    );
  };

  return (
    <div
      css={css`
        height: 760px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: var(--global-background-color-default);
      `}
    >
      <View padding="size-200" borderBottomWidth="thin" borderColor="default">
        <Flex direction="column" gap="size-50">
          <Text weight="heavy">retrieve_documents</Text>
          <Text size="XS" color="text-500">
            Nested span · 842ms
          </Text>
        </Flex>
      </View>
      <DetailPanelAnnotationBar
        rows={getRows()}
        allAnnotationConfigs={allConfigs}
        projectAnnotationConfigs={activeConfigs}
        projectName={PROJECT_NAME}
        onCreateAnnotation={async ({ annotationName, target, value }) => {
          const annotation = {
            id: `annotation-${Date.now()}`,
            name: annotationName,
            ...value,
          };
          updateTargetAnnotations({
            targetId: target.id,
            update: (annotations) => [...annotations, annotation],
          });
          return { annotation, success: true };
        }}
        onUpdateAnnotation={async ({ annotation, target, value }) => {
          updateTargetAnnotations({
            targetId: target.id,
            update: (annotations) =>
              annotations.map((currentAnnotation) =>
                currentAnnotation.id === annotation.id
                  ? { ...currentAnnotation, ...value }
                  : currentAnnotation
              ),
          });
          return { success: true };
        }}
        onDeleteAnnotation={async ({ annotation, target }) => {
          updateTargetAnnotations({
            targetId: target.id,
            update: (annotations) =>
              annotations.filter(
                (currentAnnotation) => currentAnnotation.id !== annotation.id
              ),
          });
          return { success: true };
        }}
        onUpdateAnnotationConfig={async (config) => {
          setAllConfigs((configs) =>
            configs.map((currentConfig) =>
              currentConfig.id === config.id ? config : currentConfig
            )
          );
          setActiveConfigs((configs) =>
            configs.map((currentConfig) =>
              currentConfig.id === config.id ? config : currentConfig
            )
          );
          return { success: true };
        }}
        onCreateAnnotationConfig={async (config) => {
          const savedConfig = {
            ...config,
            id: `config-${config.name.toLocaleLowerCase().replaceAll(" ", "-")}`,
          } as AnnotationConfig;
          setAllConfigs((configs) => [...configs, savedConfig]);
          setActiveConfigs((configs) => [...configs, savedConfig]);
          return { success: true };
        }}
        onAddAnnotationConfigToProject={async (configId) => {
          const config = allConfigs.find(
            (currentConfig) => currentConfig.id === configId
          );
          if (config) {
            setActiveConfigs((configs) => [...configs, config]);
          }
          return { success: true };
        }}
        onRemoveAnnotationConfigFromProject={async (configId) => {
          setActiveConfigs((configs) =>
            configs.filter((config) => config.id !== configId)
          );
          return { success: true };
        }}
      />
      <div
        css={css`
          flex: 1 1 auto;
          overflow: auto;
          padding: var(--global-dimension-size-200);
        `}
      >
        <Flex direction="column" gap="size-200">
          {Array.from({ length: 8 }, (_value, cardIndex) => (
            <Card
              key={cardIndex}
              title={`Span detail section ${cardIndex + 1}`}
            >
              <View padding="size-200">
                <Text color="text-700">
                  Representative detail content makes the panel scroll while the
                  annotation rows remain fixed at the top.
                </Text>
              </View>
            </Card>
          ))}
        </Flex>
      </div>
    </div>
  );
}

const meta = {
  title: "Detail panel/Annotation bar",
  component: DetailPanelAnnotationBar,
  parameters: {
    inset: false,
    width: "fill",
  },
  render: () => <AnnotationBarDemo />,
} satisfies Meta<typeof DetailPanelAnnotationBar>;

export default meta;
type Story = StoryObj<typeof meta>;

const getSuccessfulMutationResult = async () => ({ success: true }) as const;
const getSuccessfulCreateResult = async () =>
  ({
    annotation: { id: "annotation-created", name: "annotation" },
    success: true,
  }) as const;

export const Interactive: Story = {
  args: {
    allAnnotationConfigs: [],
    projectAnnotationConfigs: [],
    projectName: PROJECT_NAME,
    rows: [],
    onAddAnnotationConfigToProject: getSuccessfulMutationResult,
    onCreateAnnotation: getSuccessfulCreateResult,
    onCreateAnnotationConfig: getSuccessfulMutationResult,
    onDeleteAnnotation: getSuccessfulMutationResult,
    onRemoveAnnotationConfigFromProject: getSuccessfulMutationResult,
    onUpdateAnnotation: getSuccessfulMutationResult,
    onUpdateAnnotationConfig: getSuccessfulMutationResult,
  },
};

export const RowAction: Story = {
  args: {
    allAnnotationConfigs: projectConfigs,
    projectAnnotationConfigs: projectConfigs,
    projectName: PROJECT_NAME,
    rows: [{ id: "span-row", kind: "target", target: initialTargets[2] }],
    onAddAnnotationConfigToProject: getSuccessfulMutationResult,
    onCreateAnnotation: getSuccessfulCreateResult,
    onCreateAnnotationConfig: getSuccessfulMutationResult,
    onDeleteAnnotation: getSuccessfulMutationResult,
    onRemoveAnnotationConfigFromProject: getSuccessfulMutationResult,
    onUpdateAnnotation: getSuccessfulMutationResult,
    onUpdateAnnotationConfig: getSuccessfulMutationResult,
    variant: "button",
  },
  render: (args) => (
    <TraceTreeProvider>
      <div
        css={[
          traceTreePanelContentCSS,
          css`
            width: min(640px, calc(100vw - var(--global-dimension-size-400)));
            background: var(--global-background-color-default);
          `,
        ]}
      >
        <TraceTree
          spans={[ROW_ACTION_SPAN]}
          selectedSpanNodeId={ROW_ACTION_SPAN.id}
          scrollSelectedSpanIntoView={false}
          renderSpanActions={() => <DetailPanelAnnotationBar {...args} />}
        />
      </div>
    </TraceTreeProvider>
  ),
};
