import type { PromptTemplate } from "@arizeai/phoenix-evals";
import type { ModelMessage } from "ai";

import {
  DEFAULT_DATA_FORMAT,
  JSON_DATA_FORMAT,
  MESSAGES_DATA_FORMAT,
} from "../cli/config.js";

const DATA_BLOCK_PATTERN = /<data>[\s\S]*?<\/data>/;
const JSON_DATA_BLOCK = "<data>\n{{json}}\n</data>";

export type SweepRecord = Record<string, unknown>;

/**
 * Rewrite a classification prompt template so the example record is presented
 * as default XML fields, a JSON blob, or a system/user split.
 *
 * Templates must contain a `<data>…</data>` block (all current built-ins do).
 */
export function applyDataFormat({
  promptTemplate,
  record,
  dataFormat,
}: {
  promptTemplate: PromptTemplate;
  record: SweepRecord;
  dataFormat: string;
}): { promptTemplate: PromptTemplate; record: SweepRecord } {
  if (dataFormat === DEFAULT_DATA_FORMAT) {
    return { promptTemplate, record };
  }
  if (dataFormat === JSON_DATA_FORMAT) {
    assertHasDataBlock(promptTemplate);
    return {
      promptTemplate: replaceDataBlockWithJsonPlaceholder(promptTemplate),
      record: jsonRecord(record),
    };
  }
  if (dataFormat === MESSAGES_DATA_FORMAT) {
    assertHasDataBlock(promptTemplate);
    return {
      promptTemplate: splitRubricAndJsonUserMessage(promptTemplate),
      record: jsonRecord(record),
    };
  }
  throw new Error(
    `Unknown data format ${JSON.stringify(dataFormat)}. Expected ${DEFAULT_DATA_FORMAT}, ${JSON_DATA_FORMAT}, or ${MESSAGES_DATA_FORMAT}.`
  );
}

function jsonRecord(record: SweepRecord): SweepRecord {
  return { json: JSON.stringify(record) };
}

function assertHasDataBlock(promptTemplate: PromptTemplate): void {
  if (templateHasDataBlock(promptTemplate)) {
    return;
  }
  throw new Error(
    "applyDataFormat requires a <data>…</data> block in the prompt template"
  );
}

function templateHasDataBlock(promptTemplate: PromptTemplate): boolean {
  return stringContents(promptTemplate).some((content) =>
    DATA_BLOCK_PATTERN.test(content)
  );
}

function stringContents(promptTemplate: PromptTemplate): string[] {
  if (typeof promptTemplate === "string") {
    return [promptTemplate];
  }
  return promptTemplate.flatMap((message) => {
    if (typeof message.content === "string") {
      return [message.content];
    }
    return [];
  });
}

function replaceDataBlockWithJsonPlaceholder(
  promptTemplate: PromptTemplate
): PromptTemplate {
  if (typeof promptTemplate === "string") {
    return replaceDataInner(promptTemplate);
  }
  return promptTemplate.map((message) => {
    if (typeof message.content !== "string") {
      return message;
    }
    return { ...message, content: replaceDataInner(message.content) };
  });
}

function replaceDataInner(content: string): string {
  return content.replace(DATA_BLOCK_PATTERN, JSON_DATA_BLOCK);
}

function splitRubricAndJsonUserMessage(
  promptTemplate: PromptTemplate
): ModelMessage[] {
  const rubric = stringContents(promptTemplate)
    .map(stripDataBlock)
    .map((content) => content.trim())
    .filter((content) => content.length > 0)
    .join("\n\n");
  return [
    { role: "system", content: rubric },
    { role: "user", content: "{{json}}" },
  ];
}

function stripDataBlock(content: string): string {
  return content.replace(DATA_BLOCK_PATTERN, "").replace(/\n{3,}/g, "\n\n");
}
