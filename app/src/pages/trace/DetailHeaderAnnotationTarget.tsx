import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Suspense } from "react";
import type { Key } from "react-aria-components";

import {
  Button,
  Icon,
  Icons,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
} from "@phoenix/components";
import {
  SessionDetailPanelAnnotationBar,
  SpanDetailPanelAnnotationBar,
  TraceDetailPanelAnnotationBar,
  useSpanDetailPanelAnnotationBarQuery,
} from "@phoenix/components/annotation/ConnectedDetailPanelAnnotationBar";
import { assertUnreachable } from "@phoenix/typeUtils";

import { DetailPanelAnnotationBarSkeleton } from "./TraceDetailsSkeleton";

export type DetailHeaderAnnotationTarget = {
  id: string;
  kind: "session" | "span" | "trace";
  label: string;
};

const annotationTargetSelectCSS = css`
  width: fit-content;
  min-width: 0;
  max-width: min(320px, 55vw);
  overflow: hidden;

  button {
    min-width: 0;
    overflow: hidden;
  }

  .annotation-target-select__value {
    min-width: 0;
    overflow: hidden;
  }
`;

const annotationTargetValueCSS = css`
  display: inline-flex;
  flex: 0 1 auto;
  align-items: center;
  gap: var(--global-dimension-size-75);
  min-width: 0;
  max-width: 100%;

  .icon-wrap {
    flex: none;
  }

  .annotation-target-select__title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

/** Selects the entity whose annotations fill the current detail header. */
export function DetailHeaderAnnotationTargetSelect({
  onTargetChange,
  selectedTarget,
  targets,
}: {
  onTargetChange: (targetId: string) => void;
  selectedTarget: DetailHeaderAnnotationTarget;
  targets: readonly DetailHeaderAnnotationTarget[];
}) {
  const handleSelectionChange = (targetId: Key | null) => {
    if (typeof targetId === "string") {
      onTargetChange(targetId);
    }
  };

  return (
    <Select
      aria-label={`Annotations for ${getAnnotationTargetAccessibleLabel(selectedTarget)}`}
      css={annotationTargetSelectCSS}
      onSelectionChange={handleSelectionChange}
      selectedKey={selectedTarget.id}
      size="S"
    >
      <Button variant="quiet" trailingVisual={<SelectChevronUpDownIcon />}>
        <span
          className="annotation-target-select__value"
          css={annotationTargetValueCSS}
        >
          <AnnotationTargetIcon kind={selectedTarget.kind} />
          <AnnotationTargetTitle target={selectedTarget} />
        </span>
      </Button>
      <Popover placement="bottom end">
        <ListBox items={targets}>
          {(target) => (
            <SelectItem
              id={target.id}
              textValue={getAnnotationTargetAccessibleLabel(target)}
            >
              <span
                className="annotation-target-select__value"
                css={annotationTargetValueCSS}
              >
                <AnnotationTargetIcon kind={target.kind} />
                <AnnotationTargetTitle target={target} />
              </span>
            </SelectItem>
          )}
        </ListBox>
      </Popover>
    </Select>
  );
}

/** Loads exactly one annotation pile for the selected header entity. */
export function DetailHeaderAnnotationBar({
  selectedSpanAnnotationBar,
  target,
}: {
  selectedSpanAnnotationBar?: ReactNode;
  target: DetailHeaderAnnotationTarget;
}) {
  return (
    <Suspense
      fallback={<DetailPanelAnnotationBarSkeleton variant="detail-header" />}
    >
      {target.kind === "span" && selectedSpanAnnotationBar ? (
        selectedSpanAnnotationBar
      ) : target.kind === "span" ? (
        <SelectedSpanAnnotationBar key={target.id} spanNodeId={target.id} />
      ) : target.kind === "trace" ? (
        <TraceDetailPanelAnnotationBar
          key={target.id}
          traceNodeId={target.id}
        />
      ) : (
        <SessionDetailPanelAnnotationBar
          key={target.id}
          sessionNodeId={target.id}
        />
      )}
    </Suspense>
  );
}

function SelectedSpanAnnotationBar({ spanNodeId }: { spanNodeId: string }) {
  const { queryRef, refresh } =
    useSpanDetailPanelAnnotationBarQuery(spanNodeId);
  if (queryRef == null) {
    return <DetailPanelAnnotationBarSkeleton variant="detail-header" />;
  }
  return <SpanDetailPanelAnnotationBar queryRef={queryRef} refresh={refresh} />;
}

function AnnotationTargetIcon({
  kind,
}: {
  kind: DetailHeaderAnnotationTarget["kind"];
}) {
  switch (kind) {
    case "session":
      return <Icon svg={<Icons.MessagesSquare />} />;
    case "trace":
      return <Icon svg={<Icons.Trace />} />;
    case "span":
      return <Icon svg={<Icons.Workflow />} />;
    default:
      return assertUnreachable(kind);
  }
}

function AnnotationTargetTitle({
  target,
}: {
  target: DetailHeaderAnnotationTarget;
}) {
  return (
    <span className="annotation-target-select__title" title={target.label}>
      {target.label}
    </span>
  );
}

function getAnnotationTargetAccessibleLabel(
  target: DetailHeaderAnnotationTarget
) {
  switch (target.kind) {
    case "session":
      return "session";
    case "trace":
      return "trace";
    case "span":
      return `span ${target.label}`;
    default:
      return assertUnreachable(target.kind);
  }
}
