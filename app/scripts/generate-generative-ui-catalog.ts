import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  GENERATIVE_UI_TOOL_NAME,
  generativeUICatalog,
  generativeUICatalogPrompt,
} from "../src/components/agent/generativeUICatalog";

/**
 * Generates the frontend-owned generative UI catalog artifacts in
 * `src/phoenix/server/generative_ui` from the frontend generative UI catalog.
 *
 * The Python agent tool owns the static external-tool definition and loads only
 * the catalog-derived pieces it cannot know itself: the json-render spec schema,
 * component/action manifest, and generated component reference. Behavioral tool
 * guidance belongs in server-side XML prompts, not in generated artifacts. Run
 * this script via `make schema-generative-ui`. CI also runs that target to ensure
 * checked-in artifacts stay in sync whenever the frontend catalog changes.
 */
const repoRoot = path.resolve(process.cwd(), "..");
const outputDirectory = path.join(repoRoot, "src/phoenix/server/generative_ui");

const manifest = {
  version: 1,
  toolName: GENERATIVE_UI_TOOL_NAME,
  components: generativeUICatalog.componentNames,
  actions: generativeUICatalog.actionNames,
};

// json-render emits an open `props` object in `catalog.jsonSchema()` because
// each element's props depend on its runtime `type` inside an arbitrary
// `elements` record. The concrete prop contract is still generated into
// `component_reference.txt` via `catalog.prompt()` and enforced client-side with
// `generativeUICatalog.validate()` before rendering.
const specJsonSchema = getToolFriendlyJsonSchema(
  generativeUICatalog.jsonSchema()
);

const componentReference = `${getComponentReference(generativeUICatalogPrompt)}\n`;

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(outputDirectory, "component_reference.txt"),
      componentReference
    ),
    writeFile(
      path.join(outputDirectory, "spec_schema.json"),
      `${JSON.stringify(specJsonSchema, null, 2)}\n`
    ),
    writeFile(
      path.join(outputDirectory, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`
    ),
  ]);
}

void main();

function getComponentReference(prompt: string) {
  const startIndex = prompt.lastIndexOf("AVAILABLE COMPONENTS (");
  const endIndex = prompt.indexOf("AVAILABLE ACTIONS:", startIndex);
  if (startIndex === -1 || endIndex === -1) {
    return prompt;
  }
  return prompt.slice(startIndex, endIndex).trim();
}

function getToolFriendlyJsonSchema(schema: object): object {
  const result = removeRequiredField(schema, "visible");
  // removeRequiredField preserves object-ness for object inputs; the fallback is unreachable.
  return typeof result === "object" && result !== null ? result : schema;
}

/**
 * Removes json-render's internal required fields from the model-facing schema.
 * The React renderer can infer omitted visibility metadata, but catalog.jsonSchema()
 * still marks `visible` as required for its full runtime spec contract. External
 * tool callers should not have to provide that internal field.
 */
function removeRequiredField(value: unknown, fieldName: string): unknown {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== fieldName)
      .map((item) => removeRequiredField(item, fieldName));
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      key === "required" && Array.isArray(entry)
        ? entry.filter((item) => item !== fieldName)
        : removeRequiredField(entry, fieldName),
    ])
  );
}
