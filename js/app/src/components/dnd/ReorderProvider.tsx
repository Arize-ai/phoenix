import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import type { ComponentProps, ReactNode } from "react";
import { useRef } from "react";

type Sensors = ComponentProps<typeof DragDropProvider>["sensors"];

export interface ReorderProviderProps<T extends string | number> {
  /** Ids of the sortable items in current display order. Every sortable inside must appear here with a matching index. */
  order: T[];
  /** Called with the new order as it changes during a drag and when a canceled drag restores the original order. */
  onOrderChange: (order: T[]) => void;
  /**
   * Called once with the final order when a drag ends (the restored original
   * order if the drag was canceled). The committed value is read from the
   * `order` prop, so intermediate `onOrderChange` updates must be applied back
   * into it synchronously. Wire expensive consumers here and keep
   * `onOrderChange` cheap when reorders should not be applied live on every
   * drag-over step.
   */
  onOrderCommit?: (order: T[]) => void;
  /**
   * Overrides dnd-kit's default sensors, which start a drag from the sortable's
   * handle only.
   */
  sensors?: Sensors;
  children: ReactNode;
}

/**
 * Drag-and-drop boundary for a list of reorderable items. Pair with any
 * `useSortable`-based child that takes its index from `order`.
 */
export function ReorderProvider<T extends string | number>({
  order,
  onOrderChange,
  onOrderCommit,
  sensors,
  children,
}: ReorderProviderProps<T>) {
  // The order when the current drag started, restored if the drag is canceled
  const initialOrderRef = useRef<T[] | null>(null);
  return (
    <DragDropProvider
      sensors={sensors}
      onDragStart={() => {
        initialOrderRef.current = order;
      }}
      onDragOver={(event) => {
        // Commit each reorder as the drag previews it so the rest of the UI
        // moves with the dragged item. Committing state here also makes
        // dnd-kit's optimistic-sorting plugin defer to React: without a state
        // update it reorders the elements directly in the DOM, and a drag
        // released outside every sortable then left the list permanently out of
        // sync with the state behind it (#14609).
        const newOrder = move(order, event);
        if (newOrder === order) {
          return;
        }
        onOrderChange(newOrder);
      }}
      onDragEnd={(event) => {
        const initialOrder = initialOrderRef.current;
        initialOrderRef.current = null;
        // The order the user saw was already committed during the drag, so a
        // completed drag needs no change here (re-applying move() would shift
        // the item a second time); a canceled drag restores the order from
        // when the drag started.
        const finalOrder =
          event.canceled && initialOrder != null ? initialOrder : order;
        if (finalOrder !== order) {
          onOrderChange(finalOrder);
        }
        onOrderCommit?.(finalOrder);
      }}
    >
      {children}
    </DragDropProvider>
  );
}
