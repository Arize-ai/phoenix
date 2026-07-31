import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = resolve(__dirname, "../..");

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "__generated__" || entry === "node_modules") {
      continue;
    }
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      files.push(...sourceFiles(path));
    } else if (/\.tsx?$/.test(entry)) {
      files.push(path);
    }
  }
  return files;
}

/** Every graphql`` tagged template in a file. */
function graphqlDocuments(source: string): string[] {
  const documents: string[] = [];
  const tag = "graphql`";
  let index = source.indexOf(tag);
  while (index !== -1) {
    const start = index + tag.length;
    const end = source.indexOf("`", start);
    if (end === -1) {
      break;
    }
    documents.push(source.slice(start, end));
    index = source.indexOf(tag, end);
  }
  return documents;
}

/**
 * The media members of the `ContentPart` union. A document that asks for text
 * has to ask for all of these too, or it silently drops them.
 */
const MEDIA_PART_TYPES = ["ImageContentPart", "FileContentPart"] as const;

/**
 * Documents that may select `TextContentPart` without the media parts.
 *
 * Each entry needs a reason. An entry that exists because the feature is not
 * built yet should be removed as part of building it — that is the point of
 * listing it here rather than weakening the check.
 */
const EXEMPT: Record<string, string> = {
  EvaluatorPromptPreviewQuery:
    "LLM evaluator prompts reject media content server-side, so media can never appear in one.",
  PromptCodeExportCard__main:
    "Pending: the exported snippet has no representation for a media part yet.",
  PromptVersionDiffView__template:
    "Pending: diffing media needs thumbnail rendering and comparison by digest.",
};

/**
 * The media parts a document fails to ask for, if any.
 *
 * Deliberately requires the selection to appear in the document itself. A shared
 * `@inline` fragment looks like it would satisfy the same requirement in one line, and
 * this check was once relaxed to accept one — which broke every structural reader,
 * because Relay stores `@inline` data under `__fragments` rather than flattening it
 * onto the part, so `asImagePart` and friends found no `image` key and silently
 * returned nothing. Nothing else caught it: the selection was present, the types
 * compiled, and the tests fed plain objects rather than Relay data.
 *
 * If the duplication is ever worth removing again, every consumer has to move to
 * `readInlineData` in the same change, and this check has to keep failing until they
 * have.
 */
function missingMediaParts(document: string): string[] {
  return MEDIA_PART_TYPES.filter((type) => !document.includes(`on ${type}`));
}

function documentName(document: string): string {
  return (
    /(?:fragment|query|mutation|subscription)\s+(\w+)/.exec(document)?.[1] ??
    "anonymous document"
  );
}

describe("ContentPart selection sets", () => {
  /**
   * A prompt message's content is a union. Relay returns nothing for a member
   * that a document does not ask for, so a query that selects `TextContentPart`
   * but omits `ImageContentPart` silently drops the images off any prompt it
   * loads — which is exactly how images went missing when loading a saved prompt
   * into the playground. Conversion code cannot compensate; the selection has to
   * be there.
   */
  it("always request every media part alongside TextContentPart", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC_ROOT)) {
      const source = readFileSync(file, "utf8");
      if (!source.includes("TextContentPart")) {
        continue;
      }
      for (const document of graphqlDocuments(source)) {
        if (!document.includes("on TextContentPart")) {
          continue;
        }
        const name = documentName(document);
        if (name in EXEMPT) {
          continue;
        }
        const missing = missingMediaParts(document);
        if (missing.length > 0) {
          offenders.push(
            `${relative(SRC_ROOT, file)} → ${name} (missing ${missing.join(", ")})`
          );
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("finds the documents it is meant to be scanning", () => {
    const scanned = sourceFiles(SRC_ROOT)
      .map((file) => readFileSync(file, "utf8"))
      .flatMap(graphqlDocuments)
      .filter((document) => document.includes("on TextContentPart"));

    // Guards against the scan silently matching nothing (e.g. after a refactor
    // of how documents are written) and passing for the wrong reason.
    expect(scanned.length).toBeGreaterThan(0);
  });

  it("does not carry exemptions for documents that no longer need them", () => {
    const documentNames = new Set(
      sourceFiles(SRC_ROOT)
        .map((file) => readFileSync(file, "utf8"))
        .flatMap(graphqlDocuments)
        .filter(
          (document) =>
            document.includes("on TextContentPart") &&
            missingMediaParts(document).length > 0
        )
        .map(documentName)
    );

    const stale = Object.keys(EXEMPT).filter(
      (name) => !documentNames.has(name)
    );
    expect(stale).toEqual([]);
  });
});
