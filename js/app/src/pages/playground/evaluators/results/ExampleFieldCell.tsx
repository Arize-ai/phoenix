import { css } from "@emotion/react";
import type { ReactNode } from "react";

import {
  Dialog,
  DialogTrigger,
  ExpandableContent,
  Flex,
  Icon,
  IconButton,
  Icons,
  Popover,
  Text,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import { CellTop } from "@phoenix/components/table";
import { isStringKeyedObject } from "@phoenix/typeUtils";

/** The example's own fields, each an optional column in table order. */
export const EXAMPLE_FIELDS = ["input", "output", "metadata"] as const;

export type ExampleField = (typeof EXAMPLE_FIELDS)[number];

export const EXAMPLE_FIELD_LABELS: Record<ExampleField, string> = {
  input: "Input",
  output: "Output",
  metadata: "Metadata",
};

// Content height for the input and output cells. Sized so a typical single
// message input — a `messages` array holding one role/content pair, about nine
// lines pretty-printed — shows in full, since scanning inputs without expanding
// each one is the point of this table. Still shorter than the experiment
// table's primary content, as the evaluator cells beside these are two short
// rows.
const EXAMPLE_FIELD_HEIGHT = 220;

const exampleFieldContentCSS = css`
  flex: none;
  padding: var(--global-dimension-size-200);
  .cm-editor {
    background: transparent !important;
  }
`;

/**
 * A dataset field (input, output, or metadata) rendered the way the experiment compare
 * table renders an example: a header strip, a fixed-height content area that
 * fades, and the value as JSON. Always JSON — these fields are objects by
 * construction, and one representation is what lets the cell become an editor
 * later without a per-cell "which mode is this" decision.
 */
export function ExampleFieldCell({
  label,
  value,
  position,
  hideExpectedAnnotations,
}: {
  label: ExampleField;
  value: unknown;
  position: number;
  hideExpectedAnnotations: boolean;
}) {
  // Expected outputs live under metadata.annotations and already show in the
  // evaluator cells' bands, so both the cell and its expanded view leave that
  // key out; the info icon says so, and the setting brings it back.
  const isHidingAnnotations =
    label === "metadata" &&
    hideExpectedAnnotations &&
    isStringKeyedObject(value) &&
    ANNOTATIONS_KEY in value;

  const json = JSON.stringify(
    isHidingAnnotations ? omitKey(value, ANNOTATIONS_KEY) : (value ?? null),
    null,
    2
  );

  return (
    <Flex direction="column" height="100%">
      <CellTop
        extra={
          <Flex direction="row" gap="size-50" alignItems="center">
            {isHidingAnnotations ? (
              <TooltipTrigger>
                <IconButton
                  size="S"
                  color="text-500"
                  aria-label={`The "${ANNOTATIONS_KEY}" key is hidden in this cell`}
                >
                  <Icon svg={<Icons.Info />} />
                </IconButton>
                <Tooltip>
                  <TooltipArrow />
                  The &quot;{ANNOTATIONS_KEY}&quot; key is hidden. It holds the
                  expected outputs shown in the evaluator cells. Turn off
                  &quot;Hide expected annotations&quot; in run settings to see
                  it.
                </Tooltip>
              </TooltipTrigger>
            ) : null}
            <DetailsPopover
              label={`View ${label} for example ${position}`}
              icon={<Icons.Expand />}
              width={560}
            >
              <JSONBlock
                value={json}
                basicSetup={{ lineNumbers: false, foldGutter: false }}
              />
            </DetailsPopover>
          </Flex>
        }
      >
        <Text color="text-500">{label}</Text>
      </CellTop>
      <ExpandableContent height={EXAMPLE_FIELD_HEIGHT}>
        <div css={exampleFieldContentCSS}>
          <JSONBlock
            value={json}
            basicSetup={{ lineNumbers: false, foldGutter: false }}
          />
        </div>
      </ExpandableContent>
    </Flex>
  );
}

/** Where an example keeps its annotations, expected outputs included. */
const ANNOTATIONS_KEY = "annotations";

function omitKey<T extends Record<string, unknown>>(value: T, key: string) {
  const { [key]: _omitted, ...rest } = value;

  return rest;
}

/** An icon button that opens its children in a popover. */
function DetailsPopover({
  label,
  icon,
  width = 400,
  children,
}: {
  label: string;
  icon: ReactNode;
  width?: number;
  children: ReactNode;
}) {
  return (
    <DialogTrigger>
      <IconButton size="S" aria-label={label}>
        <Icon svg={icon} />
      </IconButton>
      <Popover placement="bottom end">
        <Dialog style={{ width }}>
          <View padding="size-200" maxHeight="size-6000" overflow="auto">
            {children}
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
