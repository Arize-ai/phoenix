import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  GENERATIVE_UI_CATALOG_RULES,
  GENERATIVE_UI_TOOL_NAME,
  generativeUICatalog,
  generativeUICatalogPrompt,
} from "../src/components/agent/generativeUICatalog";

/**
 * Generates the server-owned generated UI artifacts in
 * `src/phoenix/server/generative_ui` from the frontend generative UI catalog.
 *
 * The Python agent tool loads these files at runtime to define the
 * `render_generated_ui` tool's description, JSON schema, and manifest. Run this
 * script via `make schema-generative-ui`. CI also runs that target to ensure
 * the checked-in artifacts stay in sync whenever the generative UI catalog or
 * its prompt contract changes.
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
// `tool_description.txt` via `catalog.prompt()` and enforced client-side with
// `generativeUICatalog.validate()` before rendering.
const specJsonSchema = getToolFriendlyJsonSchema(
  generativeUICatalog.jsonSchema()
);

const componentReference = getComponentReference(generativeUICatalogPrompt);
const toolRules = GENERATIVE_UI_CATALOG_RULES.map((rule) => `- ${rule}`).join(
  "\n"
);
const toolDescription = [
  "Render a generated UI in the Phoenix chat using the available components below.",
  "Use this tool when a compact visual UI such as metrics, charts, or an analytical card would answer the user better than prose alone.",
  "The `spec` argument must be one complete UI tree in this shape: `{ root: string, elements: Record<string, { type: string, props: object, children: [] }> }`.",
  "`root` is the id of the chart element to render. Each chart component is a leaf node, so `children` must be an empty array.",
  "Every element `type` must come from the component list below, and every element must include `type`, `props`, and `children`.",
  "Do not provide partial updates, JSONL patches, markdown, or prose inside `spec`; provide the full render tree in one object.",
  "Follow these rules when choosing and configuring chart components:",
  toolRules,
  "",
  componentReference,
  "",
].join("\n");

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(outputDirectory, "tool_description.txt"),
      `${toolDescription}\n`
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
  return removeRequiredField(schema, "visible") as object;
}

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
