import { createContext, useContext, type ReactNode } from "react";

import type { ElicitationDraftState } from "@phoenix/components/ai/elicitation";

export type PendingElicitationDraft = ElicitationDraftState & {
  toolCallId: string;
};

const ElicitationDraftContext = createContext<PendingElicitationDraft | null>(
  null
);

export function ElicitationDraftProvider({
  draft,
  children,
}: {
  draft: PendingElicitationDraft | null;
  children: ReactNode;
}) {
  return (
    <ElicitationDraftContext.Provider value={draft}>
      {children}
    </ElicitationDraftContext.Provider>
  );
}

export function useElicitationDraft(toolCallId: string | undefined) {
  const draft = useContext(ElicitationDraftContext);

  if (!toolCallId || !draft || draft.toolCallId !== toolCallId) {
    return null;
  }

  return draft;
}
