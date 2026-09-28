import { css } from "@emotion/react";
import type { ReactNode } from "react";

import {
  Card,
  CardCollapsedPreview,
  Flex,
  LoadMoreButton,
  Token,
} from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import { SpanKindToken } from "@phoenix/components/trace/SpanKindToken";
import { isStringKeyedObject } from "@phoenix/typeUtils";
import { toContentPreview } from "@phoenix/utils/contentPreviewUtils";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

/**
 * A list of recorded spans, traces, or sessions, newest first, that grows a
 * page at a time.
 */
export function RecordPreviewList({
  listLabel,
  hasMore,
  isLoadingMore,
  onLoadMore,
  leadingContent,
  children,
}: {
  listLabel: string;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  /** Rendered above the rows, such as a note that they are samples. */
  leadingContent?: ReactNode;
  /** The rows, each a {@link RecordPreviewCard}. */
  children: ReactNode;
}) {
  return (
    <div css={recordPreviewListCSS}>
      {leadingContent}
      <ul aria-label={listLabel} className="record-preview-list__rows">
        {children}
      </ul>
      {hasMore ? (
        <Flex justifyContent="center">
          <LoadMoreButton
            isLoadingNext={isLoadingMore}
            onLoadMore={onLoadMore}
          />
        </Flex>
      ) : null}
    </div>
  );
}

const recordPreviewListCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  .record-preview-list__rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
  }
`;

/**
 * One record as a collapsible card: its span kind and name, an excerpt of its
 * input while collapsed, and `children` once expanded.
 */
export function RecordPreviewCard({
  name,
  spanKind,
  token,
  context,
  isExpanded,
  onToggleExpanded,
  collapseButtonLabel,
  titleLeadingContent,
  extra,
  children,
}: {
  name: string;
  spanKind?: string;
  /** A short label beside the title, such as "sample" or a size. */
  token?: string;
  /** The record's evaluation context, which the collapsed excerpt reads. */
  context: unknown;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  collapseButtonLabel?: string;
  /** Rendered before the span kind, such as an error count. */
  titleLeadingContent?: ReactNode;
  /** Rendered at the end of the header, such as run actions. */
  extra?: ReactNode;
  /** The expanded body; rendered only while expanded. */
  children?: ReactNode;
}) {
  return (
    <li>
      <Card
        collapsible
        // Leading content can carry a tooltip trigger, which cannot nest inside
        // the collapse button.
        interactiveTitle
        // Names the bare arrow itself; left unset it would borrow the title,
        // leading content included.
        collapseButtonLabel={collapseButtonLabel ?? `Toggle ${name}`}
        isOpen={isExpanded}
        onOpenChange={onToggleExpanded}
        title={
          <>
            {titleLeadingContent}
            {spanKind ? <SpanKindToken spanKind={spanKind} size="S" /> : null}
            {name}
          </>
        }
        titleExtra={token ? <Token size="S">{token}</Token> : null}
        headerContent={
          <CardCollapsedPreview>
            {getContextSnippet(context)}
          </CardCollapsedPreview>
        }
        extra={extra}
      >
        {isExpanded ? children : null}
      </Card>
    </li>
  );
}

/** A record's evaluation context as read-only JSON. */
export function RecordContextViewer({ context }: { context: unknown }) {
  return (
    <div css={contextViewerCSS}>
      <JSONBlock
        value={JSON.stringify(context, null, 2)}
        basicSetup={{ lineNumbers: false }}
      />
    </div>
  );
}

const contextViewerCSS = css`
  margin-top: var(--global-dimension-size-100);
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-small);
  /* CodeMirror only virtualizes long documents when it scrolls inside a
     bounded height. */
  .cm-editor {
    max-height: 400px;
  }
  .cm-scroller {
    overflow: auto;
  }
`;

/**
 * The collapsed-card excerpt for a span: the span's input, falling back to its
 * output. An LLM span's input often arrives as a serialized chat payload, so
 * surface the latest message's text rather than the raw JSON envelope.
 */
function getContextSnippet(context: unknown): string {
  if (!isStringKeyedObject(context)) {
    return "";
  }
  return (
    toContentPreview(getLatestMessageText(context.input) ?? context.input) ??
    toContentPreview(getLatestMessageText(context.output) ?? context.output) ??
    ""
  );
}

/** The text of the last non-empty message in a chat payload, if it is one. */
function getLatestMessageText(value: unknown): string | null {
  const payload =
    typeof value === "string" && value.trimStart().startsWith("{")
      ? safelyParseJSON(value).json
      : value;
  if (!isStringKeyedObject(payload) || !Array.isArray(payload.messages)) {
    return null;
  }
  for (let index = payload.messages.length - 1; index >= 0; index--) {
    const message: unknown = payload.messages[index];
    const content = isStringKeyedObject(message) ? message.content : null;
    if (typeof content === "string" && content.trim()) {
      return content;
    }
  }
  return null;
}
