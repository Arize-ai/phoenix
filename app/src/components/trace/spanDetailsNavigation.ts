const pendingDetailsNavigationFrames = new WeakMap<
  Node,
  { first: number; second?: number }
>();

function getDetailsNavigationScope(navigationRoot: Element) {
  return (
    navigationRoot.closest('[data-testid="session-traces-view"]') ??
    navigationRoot.closest("main") ??
    document
  );
}

/**
 * Paints an invalidated details state before committing route navigation.
 *
 * @param params - Painted details navigation inputs.
 * @param params.navigationRoot - Element that initiated navigation.
 * @param params.onInvalidate - Synchronous invalidation to paint first.
 * @param params.onNavigate - Route navigation to commit after invalidation paints.
 */
export function beginPaintedDetailsNavigation({
  navigationRoot,
  onInvalidate,
  onNavigate,
}: {
  navigationRoot: Element;
  onInvalidate: () => void;
  onNavigate: () => void;
}) {
  const navigationScope = getDetailsNavigationScope(navigationRoot);
  onInvalidate();

  const pendingFrames = pendingDetailsNavigationFrames.get(navigationScope);
  if (pendingFrames) {
    cancelAnimationFrame(pendingFrames.first);
    if (pendingFrames.second != null) {
      cancelAnimationFrame(pendingFrames.second);
    }
  }
  const nextFrames: { first: number; second?: number } = { first: 0 };
  nextFrames.first = requestAnimationFrame(() => {
    nextFrames.second = requestAnimationFrame(() => {
      pendingDetailsNavigationFrames.delete(navigationScope);
      onNavigate();
    });
  });
  pendingDetailsNavigationFrames.set(navigationScope, nextFrames);
}

/**
 * Invalidates visible span details, lets that state paint, and then navigates.
 *
 * @param params - Optimistic span navigation inputs.
 * @param params.navigationRoot - Element that initiated navigation.
 * @param params.onNavigate - Route navigation to commit after invalidation paints.
 * @param params.spanNodeId - Relay node ID of the target span.
 */
export function beginOptimisticSpanNavigation({
  navigationRoot,
  onNavigate,
  spanNodeId,
}: {
  navigationRoot: Element;
  onNavigate: () => void;
  spanNodeId: string;
}) {
  const navigationScope = getDetailsNavigationScope(navigationRoot);
  const detailsGate = navigationScope.querySelector<HTMLElement>(
    "[data-span-details-state]"
  );
  beginPaintedDetailsNavigation({
    navigationRoot,
    onInvalidate: () => {
      if (!detailsGate) return;

      detailsGate.dataset.spanDetailsTargetId = spanNodeId;
      const retainedDetails = detailsGate.querySelectorAll<HTMLElement>(
        "[data-span-details-retained-id]"
      );
      const cachedTarget = detailsGate.querySelector<HTMLElement>(
        `[data-span-details-retained-id="${CSS.escape(spanNodeId)}"]`
      );
      retainedDetails.forEach((details) => details.setAttribute("hidden", ""));
      const skeleton = detailsGate.querySelector<HTMLElement>(
        "[data-span-details-skeleton]"
      );
      if (cachedTarget) {
        detailsGate.dataset.spanDetailsState = "hydrating";
        skeleton?.setAttribute("hidden", "");
        cachedTarget.removeAttribute("hidden");
      } else {
        detailsGate.dataset.spanDetailsState = "dehydrated";
        skeleton?.removeAttribute("hidden");
      }
    },
    onNavigate,
  });
}

/**
 * Invalidates trace-tree and span-detail content before changing trace routes.
 *
 * @param params - Optimistic trace navigation inputs.
 * @param params.navigationRoot - Element that initiated navigation.
 * @param params.onNavigate - Route navigation to commit after invalidation paints.
 * @param params.spanNodeId - Relay node ID of the target span.
 * @param params.traceId - OpenTelemetry trace ID containing the target span.
 */
export function beginOptimisticTraceNavigation({
  navigationRoot,
  onNavigate,
  spanNodeId,
  traceId,
}: {
  navigationRoot: Element;
  onNavigate: () => void;
  spanNodeId: string;
  traceId: string;
}) {
  const navigationScope = getDetailsNavigationScope(navigationRoot);
  const navigationGate = navigationScope.querySelector<HTMLElement>(
    "[data-span-navigation-state]"
  );
  const targetTreeNode = navigationGate?.querySelector<HTMLElement>(
    `[data-trace-tree-span-node-id="${CSS.escape(spanNodeId)}"]`
  );
  const isCurrentTrace =
    navigationGate?.dataset.spanNavigationTraceId === traceId;
  if (isCurrentTrace && targetTreeNode) {
    navigationGate
      .querySelectorAll<HTMLElement>(
        '[data-trace-tree-span-node-id][data-selected="true"]'
      )
      .forEach((node) => {
        node.dataset.selected = "false";
        node.classList.remove("is-selected");
      });
    targetTreeNode.dataset.selected = "true";
    targetTreeNode.classList.add("is-selected");
  } else if (navigationGate) {
    navigationGate.dataset.spanNavigationState = "dehydrated";
    navigationGate
      .querySelector<HTMLElement>("[data-span-navigation-content]")
      ?.setAttribute("hidden", "");
    navigationGate
      .querySelector<HTMLElement>("[data-span-navigation-skeleton]")
      ?.removeAttribute("hidden");
  }

  beginOptimisticSpanNavigation({
    navigationRoot,
    onNavigate,
    spanNodeId,
  });
}

/**
 * Selects a spans-table row immediately and begins painted details navigation.
 *
 * @param params - Table span navigation inputs.
 * @param params.onNavigate - Route navigation to commit after invalidation paints.
 * @param params.spanNodeId - Relay node ID of the target span.
 * @param params.traceId - OpenTelemetry trace ID containing the target span.
 * @param params.trigger - Row or nested span link that initiated navigation.
 */
export function beginOptimisticSpanTableNavigation({
  onNavigate,
  spanNodeId,
  traceId,
  trigger,
}: {
  onNavigate: () => void;
  spanNodeId: string;
  traceId: string;
  trigger: HTMLElement;
}) {
  const targetRow = trigger.closest("tr");
  const tableBody = targetRow?.closest("tbody");
  tableBody
    ?.querySelectorAll<HTMLTableRowElement>('tr[data-selected="true"]')
    .forEach((row) => {
      row.dataset.selected = "false";
    });
  if (targetRow) {
    targetRow.dataset.selected = "true";
  }

  beginOptimisticTraceNavigation({
    navigationRoot: trigger,
    onNavigate,
    spanNodeId,
    traceId,
  });
}
