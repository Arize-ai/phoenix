import { dropOverlayCSS } from "./styles";
import type { DropOverlayProps } from "./types";

/**
 * A composable overlay that appears when a file is dragged over a parent DropZone.
 * Place as a direct child of a React Aria `DropZone` to enable.
 *
 * @example
 * ```tsx
 * <DropZone onDrop={handleDrop}>
 *   <DropOverlay>Drop file here</DropOverlay>
 *   <Form>...</Form>
 * </DropZone>
 * ```
 */
export function DropOverlay({ children }: DropOverlayProps) {
  return (
    <div css={dropOverlayCSS} aria-hidden="true">
      {children}
    </div>
  );
}
