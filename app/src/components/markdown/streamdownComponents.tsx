import { css } from "@emotion/react";
import {
  type ComponentPropsWithoutRef,
  isValidElement,
  type PropsWithChildren,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { DialogTrigger } from "react-aria-components";
import {
  extractTableDataFromElement,
  tableDataToCSV,
  tableDataToMarkdown,
  type Components,
} from "streamdown";

import { IconButton } from "../core/button";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "../core/dialog";
import { Icon, Icons } from "../core/icon";
import { Modal, ModalOverlay } from "../core/overlay";

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

const headingCSS = (level: 1 | 2 | 3 | 4 | 5 | 6) => css`
  margin: 0;
  /* Extra top padding so headings breathe away from the preceding block.
     Streamdown renders each block as a flex child, and the container gap
     alone (16px) is not enough visual separation before a heading. */
  padding-top: var(--global-dimension-size-100);
  color: var(--global-text-color-900);
  font-weight: var(--global-font-weight-semibold);

  ${
    level === 1 &&
    css`
      font-size: var(--global-font-size-xl);
      line-height: var(--global-line-height-xl);
    `
  }
  ${
    level === 2 &&
    css`
      font-size: var(--global-font-size-l);
      line-height: var(--global-line-height-l);
    `
  }
  ${
    level === 3 &&
    css`
      font-size: var(--global-font-size-m);
      line-height: var(--global-line-height-m);
    `
  }
  ${
    level === 4 &&
    css`
      font-size: var(--global-font-size-s);
      line-height: var(--global-line-height-s);
    `
  }
  ${
    level === 5 &&
    css`
      font-size: var(--global-font-size-xs);
      line-height: var(--global-line-height-xs);
    `
  }
  ${
    level === 6 &&
    css`
      font-size: var(--global-font-size-xxs);
      line-height: var(--global-line-height-xxs);
    `
  }
`;

const paragraphCSS = css`
  margin: 0;
  color: var(--global-text-color-900);
`;

const linkCSS = css`
  color: var(--global-link-color);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.15em;

  &:visited {
    color: var(--global-link-color-visited);
  }

  &:hover {
    color: var(--global-link-color);
  }
`;

const strongCSS = css`
  font-weight: var(--global-font-weight-semibold);
`;

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

const listCSS = css`
  margin: 0;
  padding-inline-start: var(--global-dimension-size-300);
`;

const listItemCSS = css`
  & + & {
    margin-top: var(--global-dimension-size-75);
  }

  &[data-task-item="true"] {
    list-style: none;
  }

  input[type="checkbox"] {
    inline-size: var(--global-dimension-size-200);
    block-size: var(--global-dimension-size-200);
    margin: 0 var(--global-dimension-size-100) 0 0;
    accent-color: var(--global-color-primary-600);
    border-radius: var(--global-rounding-small);
    vertical-align: text-bottom;
  }
`;

// ---------------------------------------------------------------------------
// Blockquote
// ---------------------------------------------------------------------------

const blockquoteCSS = css`
  margin: var(--global-dimension-size-100) 0;
  border-inline-start: var(--global-border-size-thick) solid
    var(--global-blockquote-border-color);
  padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
  background: var(--global-blockquote-background-color);
  border-radius: 0 var(--global-rounding-medium) var(--global-rounding-medium) 0;
  color: var(--global-blockquote-text-color);
`;

// ---------------------------------------------------------------------------
// Inline code
// ---------------------------------------------------------------------------

const inlineCodeCSS = css`
  padding: 0.1em 0.35em;
  border: 1px solid var(--global-inline-code-border-color);
  border-radius: var(--global-rounding-small);
  background: var(--global-inline-code-background-color);
  color: var(--global-inline-code-text-color);
  font-family: var(--ac-global-font-family-code);
  font-size: 0.9em;
  line-height: 1.4;
`;

// ---------------------------------------------------------------------------
// Shared action button style
// ---------------------------------------------------------------------------

const actionButtonCSS = css`
  border-color: transparent;
  color: var(--global-text-color-500);

  .icon-wrap {
    opacity: 1;
  }

  &[data-hovered] {
    background: var(--hover-background);
    color: var(--global-text-color-900);
  }

  &[data-pressed] {
    background: var(--global-color-primary-100);
    color: var(--global-text-color-900);
  }
`;

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

const tableWrapperCSS = css`
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  background: var(--global-markdown-table-background-color);
  overflow: hidden;
`;

const tableToolbarCSS = css`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--global-dimension-size-25);
  min-height: var(--global-dimension-size-500);
  padding: 0 var(--global-dimension-size-100);
  border-bottom: 1px solid var(--global-border-color-default);
  background: var(--global-markdown-table-toolbar-background-color);
`;

const tableScrollerCSS = css`
  overflow: auto;
`;

const tableElementCSS = css`
  width: 100%;
  border-collapse: collapse;
  margin: 0;
`;

const tableSectionHeaderCSS = css`
  background: var(--global-table-header-background-color);
`;

const tableCellCSS = css`
  border-bottom: 1px solid var(--global-table-row-border-color);
  padding: var(--global-table-cell-padding-y) var(--global-table-cell-padding-x);
  text-align: left;
  vertical-align: top;
`;

const tableHeaderCellCSS = css`
  ${tableCellCSS};
  background: var(--global-table-header-background-color);
  color: var(--global-text-color-900);
  font-weight: var(--global-font-weight-semibold);
`;

// ---------------------------------------------------------------------------
// Table fullscreen dialog body
// ---------------------------------------------------------------------------

const fullscreenBodyCSS = css`
  flex: 1;
  overflow: auto;
`;

// ---------------------------------------------------------------------------
// Misc elements
// ---------------------------------------------------------------------------

const imageCSS = css`
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: var(--global-rounding-medium);
`;

const hrCSS = css`
  margin: 0;
  border: 0;
  border-top: 1px solid var(--global-border-color-default);
`;

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

const copyToClipboard = async (content: string) => {
  await navigator.clipboard.writeText(content);
};

const downloadText = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ---------------------------------------------------------------------------
// Shared action button
// ---------------------------------------------------------------------------

function ActionIconButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
}) {
  return (
    <IconButton
      aria-label={label}
      color="text-500"
      css={actionButtonCSS}
      onPress={onPress}
      size="S"
    >
      <Icon svg={icon} />
    </IconButton>
  );
}

// ---------------------------------------------------------------------------
// Table action buttons
// ---------------------------------------------------------------------------

function TableCopyButton({
  wrapperRef,
}: {
  wrapperRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const onPress = useCallback(async () => {
    const table = wrapperRef.current?.querySelector("table");
    if (!(table instanceof HTMLTableElement)) return;
    const data = extractTableDataFromElement(table);
    await copyToClipboard(tableDataToMarkdown(data));
    setCopied(true);
  }, [wrapperRef]);

  return (
    <ActionIconButton
      label={copied ? "Copied table" : "Copy table as markdown"}
      icon={copied ? <Icons.CheckmarkOutline /> : <Icons.DuplicateOutline />}
      onPress={() => void onPress()}
    />
  );
}

function TableDownloadButton({
  wrapperRef,
}: {
  wrapperRef: React.RefObject<HTMLDivElement | null>;
}) {
  const onPress = useCallback(() => {
    const table = wrapperRef.current?.querySelector("table");
    if (!(table instanceof HTMLTableElement)) return;
    const data = extractTableDataFromElement(table);
    downloadText(tableDataToCSV(data), "table.csv", "text/csv");
  }, [wrapperRef]);

  return (
    <ActionIconButton
      label="Download table as CSV"
      icon={<Icons.DownloadOutline />}
      onPress={onPress}
    />
  );
}

function TableFullscreenButton({ children }: PropsWithChildren) {
  return (
    <DialogTrigger>
      <IconButton
        aria-label="View table fullscreen"
        color="text-500"
        css={actionButtonCSS}
        size="S"
      >
        <Icon svg={<Icons.ExpandOutline />} />
      </IconButton>
      <ModalOverlay isDismissable>
        <Modal size="L">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Table</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton />
                </DialogTitleExtra>
              </DialogHeader>
              <div css={fullscreenBodyCSS}>{children}</div>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

// ---------------------------------------------------------------------------
// Table component
// ---------------------------------------------------------------------------

function MarkdownTable(
  props: ComponentPropsWithoutRef<"table"> & { node?: unknown }
) {
  const { children, className, node: _node, ...tableProps } = props;
  const wrapperRef = useRef<HTMLDivElement>(null);

  const table = (
    <div css={tableScrollerCSS}>
      <table
        css={tableElementCSS}
        className={className}
        data-streamdown="table"
        {...tableProps}
      >
        {children}
      </table>
    </div>
  );

  return (
    <div ref={wrapperRef} css={tableWrapperCSS} data-streamdown="table-wrapper">
      <div css={tableToolbarCSS}>
        <TableCopyButton wrapperRef={wrapperRef} />
        <TableDownloadButton wrapperRef={wrapperRef} />
        <TableFullscreenButton>{table}</TableFullscreenButton>
      </div>
      {table}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported component map
// ---------------------------------------------------------------------------

export const streamdownComponents: Components = {
  h1: ({ children, className }) => (
    <h1 css={headingCSS(1)} className={className}>
      {children}
    </h1>
  ),
  h2: ({ children, className }) => (
    <h2 css={headingCSS(2)} className={className}>
      {children}
    </h2>
  ),
  h3: ({ children, className }) => (
    <h3 css={headingCSS(3)} className={className}>
      {children}
    </h3>
  ),
  h4: ({ children, className }) => (
    <h4 css={headingCSS(4)} className={className}>
      {children}
    </h4>
  ),
  h5: ({ children, className }) => (
    <h5 css={headingCSS(5)} className={className}>
      {children}
    </h5>
  ),
  h6: ({ children, className }) => (
    <h6 css={headingCSS(6)} className={className}>
      {children}
    </h6>
  ),
  p: ({ children, className }) => (
    <p css={paragraphCSS} className={className}>
      {children}
    </p>
  ),
  strong: ({ children, className }) => (
    <strong css={strongCSS} className={className}>
      {children}
    </strong>
  ),
  a: ({ children, className, href, ...rest }) => (
    <a css={linkCSS} className={className} href={href} {...rest}>
      {children}
    </a>
  ),
  ul: ({ children, className, ...rest }) => (
    <ul css={listCSS} className={className} {...rest}>
      {children}
    </ul>
  ),
  ol: ({ children, className, ...rest }) => (
    <ol css={listCSS} className={className} {...rest}>
      {children}
    </ol>
  ),
  li: ({ children, className, ...rest }) => {
    const isTaskItem =
      Array.isArray(children) &&
      children.some((child) => isValidElement(child) && child.type === "input");
    return (
      <li
        css={listItemCSS}
        className={className}
        data-task-item={isTaskItem ? "true" : undefined}
        {...rest}
      >
        {children}
      </li>
    );
  },
  blockquote: ({ children, className }) => (
    <blockquote css={blockquoteCSS} className={className}>
      {children}
    </blockquote>
  ),
  inlineCode: ({ children, className }) => (
    <code css={inlineCodeCSS} className={className}>
      {children}
    </code>
  ),
  table: MarkdownTable,
  thead: ({ children, className, ...rest }) => (
    <thead css={tableSectionHeaderCSS} className={className} {...rest}>
      {children}
    </thead>
  ),
  tbody: ({ children, className, ...rest }) => (
    <tbody className={className} {...rest}>
      {children}
    </tbody>
  ),
  tr: ({ children, className, ...rest }) => (
    <tr className={className} {...rest}>
      {children}
    </tr>
  ),
  th: ({ children, className, ...rest }) => (
    <th css={tableHeaderCellCSS} className={className} {...rest}>
      {children}
    </th>
  ),
  td: ({ children, className, ...rest }) => (
    <td css={tableCellCSS} className={className} {...rest}>
      {children}
    </td>
  ),
  img: ({ alt, className, src, ...rest }) => (
    <img alt={alt} css={imageCSS} className={className} src={src} {...rest} />
  ),
  hr: (rest) => <hr css={hrCSS} {...rest} />,
};
