import { BASH_TOOL_READONLY_ROOT } from "@phoenix/agent/tools/bash/bashToolFilesystemPolicy";

export const PHOENIX_ROOT = BASH_TOOL_READONLY_ROOT;
export const PHOENIX_META_ROOT = `${PHOENIX_ROOT}/_meta`;
export const PHOENIX_PROJECTS_ROOT = `${PHOENIX_ROOT}/projects`;
export const PHOENIX_TRACES_ROOT = `${PHOENIX_ROOT}/traces`;
export const PHOENIX_DATASETS_ROOT = `${PHOENIX_ROOT}/datasets`;
export const PHOENIX_EXPERIMENTS_ROOT = `${PHOENIX_ROOT}/experiments`;
export const PHOENIX_PROMPTS_ROOT = `${PHOENIX_ROOT}/prompts`;
export const PHOENIX_EVALUATORS_ROOT = `${PHOENIX_ROOT}/evaluators`;

export function getPhoenixProjectRoot(projectId: string) {
  return `${PHOENIX_PROJECTS_ROOT}/${projectId}`;
}

export function getPhoenixTraceRoot(traceId: string) {
  return `${PHOENIX_TRACES_ROOT}/${traceId}`;
}

export function getPhoenixTablesRoot(entityRoot: string) {
  return `${entityRoot}/tables`;
}

export function getPhoenixTopLevelIndexPaths() {
  return [
    `${PHOENIX_PROJECTS_ROOT}/INDEX.json`,
    `${PHOENIX_TRACES_ROOT}/INDEX.json`,
    `${PHOENIX_DATASETS_ROOT}/INDEX.json`,
    `${PHOENIX_EXPERIMENTS_ROOT}/INDEX.json`,
    `${PHOENIX_PROMPTS_ROOT}/INDEX.json`,
    `${PHOENIX_EVALUATORS_ROOT}/INDEX.json`,
  ] as const;
}
