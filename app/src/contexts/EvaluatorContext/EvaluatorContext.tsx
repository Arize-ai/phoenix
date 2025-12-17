import { createContext, useState } from "react";

import {
  createEvaluatorStore,
  type EvaluatorStoreInstance,
  type EvaluatorStoreProps,
} from "@phoenix/store/evaluatorStore";
import type { EvaluatorKind } from "@phoenix/types";

export const EvaluatorContext = createContext<EvaluatorStoreInstance | null>(
  null
);

export const EvaluatorStoreProvider = ({
  children: _children,
  initialState,
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
  const children =
    typeof _children === "function" ? _children({ store }) : _children;
  return (
    <EvaluatorContext.Provider value={store}>
      {children}
    </EvaluatorContext.Provider>
  );
};
