import { Label } from "@phoenix/components";
import { CodeWrap } from "@phoenix/components/code";
import { JSONEditor } from "@phoenix/components/code/JSONEditor";
import { fieldBaseCSS } from "@phoenix/components/field/styles";

type JSONInputEditorProps = {
  /**
   * The JSON string value
   */
  value: string;
  /**
   * Callback when the JSON value changes
   */
  onChange: (value: string) => void;
};

/**
 * A JSON editor for playground input when using JSON_PATH template format.
 * This replaces individual variable fields with a single JSON object editor
 * that provides the data for JSON path expressions to query against.
 */
export function JSONInputEditor({ value, onChange }: JSONInputEditorProps) {
  return (
    <div css={fieldBaseCSS}>
      <Label>JSON Input Data</Label>
      <CodeWrap width="100%">
        <JSONEditor
          value={value}
          onChange={onChange}
          optionalLint={true}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLine: true,
            foldGutter: true,
          }}
        />
      </CodeWrap>
    </div>
  );
}
