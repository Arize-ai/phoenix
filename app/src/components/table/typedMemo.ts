import { memo } from "react";
import type { ReactNode } from "react";

/**
 * `React.memo` for generic components.
 *
 * `memo()` is typed to return a `MemoExoticComponent`, which erases a
 * component's type parameters — memoizing `<T,>(props: { table: Table<T> })`
 * yields something that no longer accepts a type argument, so every call site
 * otherwise has to assert the result back to `typeof Component`.
 *
 * This is the single sanctioned home for that assertion: the pass-through
 * signature keeps `C` intact, and `Parameters<C>[0]` gives `propsAreEqual` the
 * component's real props instead of leaving them implicitly `any`.
 *
 * Runtime behavior is exactly `React.memo` — this only restores the type.
 */
export const typedMemo: <C extends (props: never) => ReactNode>(
  component: C,
  propsAreEqual?: (prev: Parameters<C>[0], next: Parameters<C>[0]) => boolean
) => C =
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- memo's own signature cannot express "returns the component type unchanged"; see the doc comment above
  memo as <C extends (props: never) => ReactNode>(
    component: C,
    propsAreEqual?: (prev: Parameters<C>[0], next: Parameters<C>[0]) => boolean
  ) => C;
