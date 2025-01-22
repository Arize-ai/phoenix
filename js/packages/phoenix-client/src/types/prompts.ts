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
