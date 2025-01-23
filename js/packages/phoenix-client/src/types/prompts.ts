import { components } from "../__generated__/api/v1";

export interface GetPromptById {
  promptId: string;
}

export interface GetPromptByName {
  name: string;
}

export interface GetPromptByVersion {
  versionId: string;
}

export interface GetPromptByTag {
  tag: string;
  name: string;
}

export type PromptLike =
  | GetPromptById
  | GetPromptByName
  | GetPromptByVersion
  | GetPromptByTag;

export type PromptVersion = components["schemas"]["PromptVersion"];

export type Prompt = components["schemas"]["Prompt"];
