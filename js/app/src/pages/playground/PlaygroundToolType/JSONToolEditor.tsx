import { useCallback, useRef, useState } from "react";

import { JSONEditor } from "@phoenix/components/code";
import { LazyEditorWrapper } from "@phoenix/components/code/LazyEditorWrapper";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
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
  tool: _tool,
  displayDefinition,
  updateTool,
  toolDefinitionJSONSchema,
}: JSONToolProps) => {
  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === playgroundInstanceId)
  );

  if (instance == null) {
    throw new Error(`Playground instance ${playgroundInstanceId} not found`);
  }
  const instanceProvider = instance.model.provider;
  const initialEditorValue = JSON.stringify(displayDefinition, null, 2);
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
    <LazyEditorWrapper
      preInitializationMinHeight={TOOL_EDITOR_PRE_INIT_HEIGHT}
      data-testid="playground-tool-editor"
    >
      <UncontrolledJSONToolEditor
        key={instanceProvider}
        initialValue={initialEditorValue}
        onChange={onChange}
        jsonSchema={toolDefinitionJSONSchema}
      />
    </LazyEditorWrapper>
  );
};

function UncontrolledJSONToolEditor({
  initialValue,
  onChange,
  jsonSchema,
}: {
  initialValue: string;
  onChange: (value: string) => void;
  jsonSchema: JSONToolProps["toolDefinitionJSONSchema"];
}) {
  const [value] = useState(initialValue);
  return (
    <JSONEditor value={value} onChange={onChange} jsonSchema={jsonSchema} />
  );
}
