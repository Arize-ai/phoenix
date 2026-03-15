import { useCallback, useEffect, useRef, useState } from "react";

import { JSONEditor } from "@phoenix/components/code";
import { LazyEditorWrapper } from "@phoenix/components/code/LazyEditorWrapper";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import type { BaseToolEditorProps } from "@phoenix/pages/playground/PlaygroundTool";
import { getToolDefinitionDisplay } from "@phoenix/pages/playground/playgroundUtils";
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
  displayDefinition,
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
    JSON.stringify(displayDefinition, null, 2)
  );
  const editorValueRef = useRef(initialEditorValue);

  // When the instance provider changes, re-derive the display value from the
  // canonical form and reset the editor.
  useEffect(() => {
    const state = store.getState();
    const instance = state.instances.find((i) => i.id === playgroundInstanceId);
    if (instance == null) {
      return;
    }
    const tool = instance.tools.find((t) => t.id === toolId);
    if (tool == null || tool.definition == null) {
      return;
    }
    const displayValue = getToolDefinitionDisplay(
      tool.definition,
      instance.model.provider
    );
    const newDefinition = JSON.stringify(displayValue, null, 2);
    if (isJSONString({ str: newDefinition, excludeNull: true })) {
      // eslint-disable-next-line react-hooks-js/set-state-in-effect
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
