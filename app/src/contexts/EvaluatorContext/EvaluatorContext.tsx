import { createContext, useEffect, useState } from "react";

import {
  createEvaluatorStore,
  type EvaluatorStoreInstance,
  type EvaluatorStoreProps,
} from "@phoenix/store/evaluatorStore";
import type { EvaluatorKind } from "@phoenix/types";

export const EvaluatorContext = createContext<EvaluatorStoreInstance | null>(
  null
);

const DEFAULT_DEPENDENCIES: unknown[] = [];

export const EvaluatorStoreProvider = ({
  children: _children,
  initialState,
  dependencies = DEFAULT_DEPENDENCIES,
}: {
  children:
    | React.ReactNode
    | (({ store }: { store: EvaluatorStoreInstance }) => React.ReactNode);
  initialState: Partial<EvaluatorStoreProps> & {
    evaluator: { kind: EvaluatorKind };
  };
  dependencies?: unknown[];
}) => {
  const [store] = useState<EvaluatorStoreInstance>(() =>
    createEvaluatorStore(initialState)
  );
  // render and cache function children
  const [children, setChildren] = useState(() => {
    if (typeof _children === "function") {
      return _children({ store });
    }
    return _children;
  });
  // similar to react-aria-components;
  // cache the children function result and only re-render if the "dependencies" change
  // dependencies are completely arbitrary, and can be any value that should re-mount
  // the children function result
  useEffect(() => {
    setChildren(() => {
      if (typeof _children === "function") {
        return _children({ store });
      }
      return _children;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
  return (
    <EvaluatorContext.Provider value={store}>
      {children}
    </EvaluatorContext.Provider>
  );
};
