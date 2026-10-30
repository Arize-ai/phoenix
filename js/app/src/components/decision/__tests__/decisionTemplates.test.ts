import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { TemplateFormat } from "@phoenix/components/templateEditor/types";

import { getWholeTagPath } from "../decisionTemplates";

/** The server's cases, so the playground and server read a whole tag alike. */
const CASES_PATH = resolve(
  __dirname,
  "../../../../../../tests/unit/server/decisions/rendering_cases.json"
);

type WholeTagCase = {
  template_format: TemplateFormat;
  text: string;
  path: string | null;
};

const { whole_tags: wholeTags } = JSON.parse(
  readFileSync(CASES_PATH, "utf-8")
) as { whole_tags: WholeTagCase[] };

describe("getWholeTagPath", () => {
  it.each(wholeTags)(
    "$template_format $text names $path",
    ({ template_format, text, path }) => {
      expect(getWholeTagPath({ templateFormat: template_format, text })).toBe(
        path
      );
    }
  );
});
