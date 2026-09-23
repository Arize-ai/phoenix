import { css } from "@emotion/react";
import { type ReactNode, Suspense, useEffect, useRef } from "react";
import { Panel, Separator } from "react-resizable-panels";
import type { PanelImperativeHandle } from "react-resizable-panels";

import {
  Button,
  CopyField,
  CopyInput,
  ErrorBoundary,
  Flex,
  Icon,
  Icons,
  Label,
  Skeleton,
  Text,
  TextErrorBoundaryFallback,
  View,
} from "@phoenix/components";
import { TitledPanel } from "@phoenix/components/react-resizable-panels";
import { compactResizeHandleCSS } from "@phoenix/components/resize";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { useProjectContext } from "@phoenix/contexts/ProjectContext";

const ASIDE_PANEL_DEFAULT_SIZE_PIXELS = 360;
const ASIDE_PANEL_MIN_SIZE_PIXELS = 320;
const ASIDE_PANEL_MAX_SIZE_PIXELS = 600;

/**
 * Wires a table's collapsible aside panel to the shared `showTableAside`
 * project-store flag: expands/collapses the panel when the store changes, and
 * writes drag-driven expand/collapse back to the store. The didSync ref keeps
 * the panel's initial mount (before the store value has been applied) from
 * clobbering the store via onResize.
 */
function useTableAsidePanel() {
  const showTableAside = useProjectContext((state) => state.showTableAside);
  const setShowTableAside = useProjectContext(
    (state) => state.setShowTableAside
  );
  const asidePanelRef = useRef<PanelImperativeHandle>(null);
  const didSyncAsideFromStoreRef = useRef(false);
  useEffect(() => {
    const panel = asidePanelRef.current;
    if (!panel) return;
    if (showTableAside && panel.isCollapsed()) {
      panel.expand();
    } else if (!showTableAside && !panel.isCollapsed()) {
      panel.collapse();
    }
    didSyncAsideFromStoreRef.current = true;
  }, [showTableAside]);
  const onAsidePanelResize = (panelSize: { asPercentage: number }) => {
    if (!didSyncAsideFromStoreRef.current) return;
    const shouldBeVisible = panelSize.asPercentage > 0;
    if (shouldBeVisible !== showTableAside) {
      setShowTableAside(shouldBeVisible);
    }
  };
  return { showTableAside, asidePanelRef, onAsidePanelResize };
}

/**
 * The resizable, collapsible aside panel of a table page: the drag separator,
 * the panel itself (wired to the shared `showTableAside` store flag), and the
 * error/suspense boundaries around the aside content. Render it as the last
 * child of the table's resizable `Group`.
 */
export function TableAsidePanel({ children }: { children: ReactNode }) {
  const { showTableAside, asidePanelRef, onAsidePanelResize } =
    useTableAsidePanel();
  return (
    <>
      <Separator
        css={compactResizeHandleCSS}
        disabled={!showTableAside}
        style={showTableAside ? undefined : { display: "none" }}
      />
      <Panel
        panelRef={asidePanelRef}
        defaultSize={ASIDE_PANEL_DEFAULT_SIZE_PIXELS}
        collapsedSize={0}
        minSize={ASIDE_PANEL_MIN_SIZE_PIXELS}
        maxSize={ASIDE_PANEL_MAX_SIZE_PIXELS}
        collapsible
        onResize={onAsidePanelResize}
      >
        {showTableAside ? (
          <ErrorBoundary fallback={TextErrorBoundaryFallback}>
            <Suspense fallback={<TableAsideSkeleton />}>{children}</Suspense>
          </ErrorBoundary>
        ) : null}
      </Panel>
    </>
  );
}

/**
 * Toolbar button that toggles a table's aside panel open or closed.
 */
export function TableAsideToggleButton() {
  const showTableAside = useProjectContext((state) => state.showTableAside);
  const setShowTableAside = useProjectContext(
    (state) => state.setShowTableAside
  );
  return (
    <Button
      size="M"
      aria-label={showTableAside ? "Hide aside panel" : "Show aside panel"}
      leadingVisual={
        <Icon svg={showTableAside ? <Icons.SlideIn /> : <Icons.SlideOut />} />
      }
      onPress={() => setShowTableAside(!showTableAside)}
    />
  );
}

/**
 * A single labeled stat in an aside's Stats panel.
 */
export function StatItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Flex direction="column" flex="none">
      <Text elementType="h3" size="S" color="text-700">
        {label}
      </Text>
      {children}
    </Flex>
  );
}

/**
 * A latency/duration stat that renders "--" when the value is unavailable.
 */
export function LatencyStatItem({
  label,
  latencyMs,
}: {
  label: string;
  latencyMs?: number | null;
}) {
  return (
    <StatItem label={label}>
      {latencyMs != null ? (
        <LatencyText latencyMs={latencyMs} size="L" />
      ) : (
        <Text size="L">--</Text>
      )}
    </StatItem>
  );
}

const sectionHeadingCSS = css`
  font-size: var(--global-font-size-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--global-text-color-700);
  margin: 0 0 var(--global-dimension-size-100) 0;
  padding-bottom: var(--global-dimension-size-50);
  border-bottom: 1px solid var(--global-border-color-default);
`;

/**
 * A titled group of stats. The heading doubles as a divider — an underlined,
 * uppercase label — so each level of feedback (span, document, trace, session)
 * reads as its own clearly delineated section rather than one undifferentiated
 * list.
 */
export function StatsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      css={css`
        width: 100%;
      `}
    >
      <h3 css={sectionHeadingCSS}>{title}</h3>
      <Flex direction="column" gap="size-200" alignItems="start">
        {children}
      </Flex>
    </section>
  );
}

/**
 * The "Project Info" section of a table aside — name, ID, and description as
 * copyable fields. Shared by the spans and sessions asides.
 */
export function ProjectInfoTitledPanel({
  projectId,
  name,
  description,
}: {
  projectId: string;
  name?: string | null;
  description?: string | null;
}) {
  return (
    <TitledPanel
      title="Project Info"
      panelProps={{
        defaultSize: "0%",
        minSize: 240,
      }}
    >
      <View padding="size-200" overflow="auto" height="100%">
        <Flex direction="column" gap="size-100" minWidth="size-3400">
          <CopyField value={name ?? ""}>
            <Label>Name</Label>
            <CopyInput />
          </CopyField>
          <CopyField value={projectId}>
            <Label>ID</Label>
            <CopyInput />
          </CopyField>
          <CopyField value={description ?? ""}>
            <Label>Description</Label>
            <CopyInput />
          </CopyField>
        </Flex>
      </View>
    </TitledPanel>
  );
}

/**
 * Loading placeholder for a table aside while its stats query is in flight.
 */
function TableAsideSkeleton() {
  return (
    <View padding="size-200" overflow="hidden" height="100%" aria-hidden="true">
      <Flex direction="column" gap="size-200" minWidth="size-3400">
        <Skeleton width={96} height={20} animation="wave" />
        <Skeleton width="100%" height={32} animation="wave" />
        <Skeleton width={72} height={20} animation="wave" />
        <Skeleton width={96} height={24} animation="wave" />
        <Skeleton width={84} height={20} animation="wave" />
        <Skeleton width={72} height={24} animation="wave" />
        <Skeleton width={84} height={20} animation="wave" />
        <Skeleton width={80} height={24} animation="wave" />
      </Flex>
    </View>
  );
}
