import {
  DOCUMENT_CONTENT,
  DOCUMENT_ID,
  DOCUMENT_METADATA,
  DOCUMENT_SCORE,
  MESSAGE_CONTENT,
  MESSAGE_NAME,
  MESSAGE_ROLE,
} from "./semanticConventions";

export type AttributeMessage = {
  [MESSAGE_ROLE]: string;
  [MESSAGE_CONTENT]: string;
  [MESSAGE_NAME]?: string;
  [key: string]: unknown;
};

export type AttributeDocument = {
  [DOCUMENT_ID]?: string;
  [DOCUMENT_CONTENT]: string;
  [DOCUMENT_SCORE]?: number;
  [DOCUMENT_METADATA]?: string;
  [key: string]: unknown;
};
