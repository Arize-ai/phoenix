import { foldAll, forceParsing, unfoldAll } from "@codemirror/language";
import type { EditorState, EditorView } from "@uiw/react-codemirror";
import { useEffect, useRef } from "react";

import { useCollapsibleContent } from "@phoenix/components/core/contexts/CollapsibleContentContext";

type OnCreateEditor = (
  editorView: EditorView,
  editorState: EditorState
) => void;

function applyExpansionAction({
  action,
  editorView,
}: {
  action: "collapse" | "expand";
  editorView: EditorView;
}) {
  if (action === "collapse") {
    forceParsing(editorView, editorView.state.doc.length);
    foldAll(editorView);
  } else {
    unfoldAll(editorView);
  }
}

/**
 * Connects a CodeMirror fold tree to the nearest expand/collapse-all scope.
 *
 * @param params - Hook parameters.
 * @param params.onCreateEditor - Optional consumer callback to preserve.
 */
export function useCodeMirrorCollapsibleContent({
  onCreateEditor,
}: {
  onCreateEditor?: OnCreateEditor;
} = {}) {
  const { actionVersion, expansionAction } = useCollapsibleContent();
  const editorViewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (expansionAction && editorViewRef.current) {
      applyExpansionAction({
        action: expansionAction,
        editorView: editorViewRef.current,
      });
    }
  }, [actionVersion, expansionAction]);

  return (editorView: EditorView, editorState: EditorState) => {
    editorViewRef.current = editorView;
    if (expansionAction) {
      applyExpansionAction({ action: expansionAction, editorView });
    }
    onCreateEditor?.(editorView, editorState);
  };
}
