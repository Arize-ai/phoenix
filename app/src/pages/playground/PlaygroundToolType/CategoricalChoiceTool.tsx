import { BaseToolEditorProps } from "@phoenix/pages/playground/PlaygroundTool";

type CategoricalChoiceToolProps = BaseToolEditorProps;

export const CategoricalChoiceTool = (props: CategoricalChoiceToolProps) => {
  return <pre>{JSON.stringify(props.tool.definition, null, 2)}</pre>;
};
