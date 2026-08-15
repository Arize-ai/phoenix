import { css } from "@emotion/react";
import { useMemo, useState } from "react";

import { Icon, Icons, Text } from "@phoenix/components";
import { isStringKeyedObject } from "@phoenix/typeUtils";
import { toContentPreview } from "@phoenix/utils/contentPreviewUtils";
import { toBracketSegment } from "@phoenix/utils/jsonUtils";

const BARE_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Extends a path by one key, in the notation the server parses.
 *
 * Attribute keys carry dots of their own — `llm.model_name` is one key, not two
 * — so anything that is not a bare identifier is quoted into a bracket segment
 * rather than joined with a dot.
 */
export function appendPathSegment(
  parentPath: string,
  key: string,
  isIndex: boolean
): string {
  if (isIndex) {
    return `${parentPath}[${key}]`;
  }
  if (!parentPath) {
    return key;
  }
  return BARE_IDENTIFIER_PATTERN.test(key)
    ? `${parentPath}.${key}`
    : `${parentPath}${toBracketSegment(key)}`;
}

type EntityNode = {
  key: string;
  path: string;
  value: unknown;
  isIndex: boolean;
};

function childNodes(value: unknown, path: string): EntityNode[] {
  if (Array.isArray(value)) {
    return value.map((child, index) => ({
      key: `${index}`,
      path: appendPathSegment(path, `${index}`, true),
      value: child,
      isIndex: true,
    }));
  }
  if (isStringKeyedObject(value)) {
    return Object.entries(value).map(([key, child]) => ({
      key,
      path: appendPathSegment(path, key, false),
      value: child,
      isIndex: false,
    }));
  }
  return [];
}

function describeType(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return `list · ${value.length}`;
  }
  if (isStringKeyedObject(value)) {
    return "object";
  }
  return typeof value;
}

/**
 * The record an evaluator's inputs are read from, as a tree of the fields it
 * actually holds, with the value each field has on the record being previewed.
 *
 * Choosing a field yields the path that reads it — rooted at the record, so the
 * path stored on the evaluator is the path shown here and the path quoted back
 * if it ever stops matching.
 */
export function EvaluatorEntityTree({
  entity,
  rootPath,
  rootLabel,
  selectedPath,
  onSelectPath,
}: {
  /** The record document, as the server builds it. */
  entity: Record<string, unknown>;
  /** The path prefix every emitted path carries: `span` or `session`. */
  rootPath: string;
  /** How the record reads in the tree: `Span` or `Session`. */
  rootLabel: string;
  selectedPath?: string;
  onSelectPath: (path: string) => void;
}) {
  const roots = useMemo(() => childNodes(entity, rootPath), [entity, rootPath]);
  if (roots.length === 0) {
    return (
      <div css={entityTreeCSS}>
        <Text size="S" color="text-500">
          No fields yet. Pick a record above to see what it holds.
        </Text>
      </div>
    );
  }
  return (
    <div css={entityTreeCSS}>
      <button
        type="button"
        className="entity-tree__node entity-tree__node--root"
        data-selected={selectedPath === rootPath || undefined}
        onClick={() => onSelectPath(rootPath)}
      >
        <span className="entity-tree__key">{rootLabel}</span>
        <span className="entity-tree__type">whole record</span>
      </button>
      <ul className="entity-tree__list">
        {roots.map((node) => (
          <EvaluatorEntityTreeNode
            key={node.path}
            node={node}
            depth={0}
            selectedPath={selectedPath}
            onSelectPath={onSelectPath}
          />
        ))}
      </ul>
    </div>
  );
}

function EvaluatorEntityTreeNode({
  node,
  depth,
  selectedPath,
  onSelectPath,
}: {
  node: EntityNode;
  depth: number;
  selectedPath?: string;
  onSelectPath: (path: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const children = useMemo(
    // Children are built only once a branch opens; a wide attribute tree would
    // otherwise be walked in full every time the picker renders.
    () => (isExpanded ? childNodes(node.value, node.path) : []),
    [isExpanded, node.value, node.path]
  );
  const hasChildren =
    (Array.isArray(node.value) && node.value.length > 0) ||
    (isStringKeyedObject(node.value) && Object.keys(node.value).length > 0);
  const preview = toContentPreview(node.value, { maxLength: 48 });
  return (
    <li>
      <div
        className="entity-tree__row"
        style={{
          paddingLeft: `calc(${depth} * var(--global-dimension-size-150))`,
        }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="entity-tree__toggle"
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.path}`}
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((current) => !current)}
          >
            <Icon
              svg={isExpanded ? <Icons.ChevronDown /> : <Icons.ChevronRight />}
            />
          </button>
        ) : (
          <span className="entity-tree__toggle entity-tree__toggle--empty" />
        )}
        <button
          type="button"
          className="entity-tree__node"
          data-selected={selectedPath === node.path || undefined}
          onClick={() => onSelectPath(node.path)}
        >
          <span className="entity-tree__key">{node.key}</span>
          <span className="entity-tree__type">{describeType(node.value)}</span>
          {preview ? (
            <span className="entity-tree__value">{preview}</span>
          ) : null}
        </button>
      </div>
      {isExpanded && children.length > 0 ? (
        <ul className="entity-tree__list">
          {children.map((child) => (
            <EvaluatorEntityTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelectPath={onSelectPath}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

const entityTreeCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-25);
  max-height: 320px;
  overflow: auto;
  padding: var(--global-dimension-size-100);

  .entity-tree__list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .entity-tree__row {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-50);
  }
  .entity-tree__toggle {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--global-dimension-size-200);
    height: var(--global-dimension-size-200);
    padding: 0;
    border: none;
    border-radius: var(--global-rounding-small);
    background: none;
    color: var(--global-text-color-500);
    cursor: pointer;
    &:hover {
      background-color: rgba(var(--global-color-gray-500-rgb), 0.15);
    }
  }
  .entity-tree__toggle--empty {
    cursor: default;
  }
  .entity-tree__node {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: var(--global-dimension-size-100);
    padding: var(--global-dimension-size-25) var(--global-dimension-size-75);
    border: none;
    border-radius: var(--global-rounding-small);
    background: none;
    cursor: pointer;
    text-align: left;
    &:hover {
      background-color: rgba(var(--global-color-gray-500-rgb), 0.15);
    }
    &:focus-visible {
      outline: 2px solid var(--global-color-info);
      outline-offset: 1px;
    }
    &[data-selected] {
      background-color: rgba(var(--global-color-gray-900-rgb), 0.12);
    }
  }
  .entity-tree__node--root {
    width: 100%;
  }
  .entity-tree__key {
    flex: none;
    font-family: var(--global-font-family-mono);
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-900);
  }
  .entity-tree__type {
    flex: none;
    font-size: var(--global-font-size-xxs);
    color: var(--global-text-color-500);
  }
  .entity-tree__value {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--global-font-size-xxs);
    color: var(--global-text-color-500);
  }
`;
