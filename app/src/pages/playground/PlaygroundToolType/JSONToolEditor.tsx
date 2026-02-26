import { useCallback, useMemo, useRef } from "react";

import { JSONEditor } from "@phoenix/components/code";
import { LazyEditorWrapper } from "@phoenix/components/code/LazyEditorWrapper";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import type { BaseToolEditorProps } from "@phoenix/pages/playground/PlaygroundTool";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

/**
 * The minimum height for the editor before it is initialized.
 * This is to ensure that the editor is properly initialized when it is rendered outside of the viewport.
 */
const TOOL_EDITOR_PRE_INIT_HEIGHT = 400;

type JSONToolProps = BaseToolEditorProps;

export const JSONToolEditor = ({
  playgroundInstanceId,
  tool,
  updateTool,
  toolDefinitionJSONSchema,
}: JSONToolProps) => {
  const store = usePlaygroundStore();
  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === playgroundInstanceId)
  );

  if (instance == null) {
    throw new Error(`Playground instance ${playgroundInstanceId} not found`);
  }
  const toolId = tool.id;
  const initialEditorValue = useMemo(() => {
    const state = store.getState();
    const latestInstance = state.instances.find(
      (i) => i.id === playgroundInstanceId
    );
    if (latestInstance != null) {
      const latestTool = latestInstance.tools.find((t) => t.id === toolId);
      if (latestTool != null) {
        return JSON.stringify(latestTool.definition, null, 2);
      }
    }
    return JSON.stringify(tool.definition, null, 2);
  }, [playgroundInstanceId, store, tool.definition, toolId]);
  const editorValueRef = useRef(initialEditorValue);

  const onChange = useCallback(
    (value: string) => {
      editorValueRef.current = value;
      const { json: definition } = safelyParseJSON(value);
      updateTool(definition);
    },
    [updateTool]
  );
  return (
    <LazyEditorWrapper preInitializationMinHeight={TOOL_EDITOR_PRE_INIT_HEIGHT}>
      <JSONEditor
        value={initialEditorValue}
        onChange={onChange}
        jsonSchema={toolDefinitionJSONSchema}
      />
    </LazyEditorWrapper>
  );
};
