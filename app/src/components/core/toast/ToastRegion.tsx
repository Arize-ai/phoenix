import { UNSTABLE_ToastRegion as AriaToastRegion } from "react-aria-components";

import { toastRegionCSS } from "@phoenix/components/core/toast/styles";
import { toastQueue } from "@phoenix/contexts/NotificationContext";

import { Toast } from "./Toast";

/**
 * Measures the toast stack and exposes layout custom properties on the region
 * (`--toast-count`, `--toast-row-height`, `--toast-stack-height`) and on each
 * `.toast-positioner` (`--toast-offset`, the cumulative height of the toasts in
 * front of it) so the CSS can size the animated region height and lay the
 * toasts out — collapsed by default, un-stacked on hover/focus.
 *
 * Used as a `ref` callback; the returned function tears down the observers.
 */
function attachToastRegion(region: HTMLElement | null) {
  if (!region) {
    return undefined;
  }
  const measure = () => {
    const positioners =
      region.querySelectorAll<HTMLElement>(".toast-positioner");
    region.style.setProperty("--toast-count", String(positioners.length || 1));
    let rowHeight = 0;
    let stackHeight = 0;
    positioners.forEach((positioner) => {
      positioner.style.setProperty("--toast-offset", `${stackHeight}px`);
      const toast = positioner.querySelector<HTMLElement>(".react-aria-Toast");
      const height = toast ? toast.offsetHeight : 0;
      rowHeight = Math.max(rowHeight, height);
      stackHeight += height;
    });
    if (rowHeight > 0) {
      region.style.setProperty("--toast-row-height", `${rowHeight}px`);
    }
    region.style.setProperty("--toast-stack-height", `${stackHeight}px`);
  };
  const resizeObserver = new ResizeObserver(measure);
  resizeObserver.observe(region);
  const observeToasts = () => {
    region
      .querySelectorAll<HTMLElement>(".react-aria-Toast")
      .forEach((toast) => resizeObserver.observe(toast));
  };
  const mutationObserver = new MutationObserver(() => {
    observeToasts();
    measure();
  });
  mutationObserver.observe(region, { childList: true, subtree: true });
  observeToasts();
  measure();
  return () => {
    resizeObserver.disconnect();
    mutationObserver.disconnect();
  };
}

export const ToastRegion = () => {
  return (
    <AriaToastRegion
      ref={attachToastRegion}
      queue={toastQueue}
      css={toastRegionCSS}
      className="react-aria-ToastRegion"
    >
      {({ toast }) => {
        return <Toast toast={toast} />;
      }}
    </AriaToastRegion>
  );
};
