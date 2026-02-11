import { useCallback, useEffect, useRef, useState } from "react";

import { JSONEditor } from "@phoenix/components/code";
import { LazyEditorWrapper } from "@phoenix/components/code/LazyEditorWrapper";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { BaseToolEditorProps } from "@phoenix/pages/playground/PlaygroundTool";
import { isJSONString, safelyParseJSON } from "@phoenix/utils/jsonUtils";

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
  const instanceProvider = instance.model.provider;
  const [initialEditorValue, setInitialEditorValue] = useState(() =>
    JSON.stringify(tool.definition, null, 2)
  );
  const editorValueRef = useRef(initialEditorValue);

  // when the instance provider changes, we need to update the editor value
  // to reflect the new tool definition schema
  useEffect(() => {
    const state = store.getState();
    const instance = state.instances.find((i) => i.id === playgroundInstanceId);
    if (instance == null) {
      return;
    }
    const tool = instance.tools.find((t) => t.id === toolId);
    if (tool == null) {
      return;
    }
    const newDefinition = JSON.stringify(tool.definition, null, 2);
    if (isJSONString({ str: newDefinition, excludeNull: true })) {
      setInitialEditorValue(newDefinition);
    }
  }, [instanceProvider, store, playgroundInstanceId, toolId]);
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
