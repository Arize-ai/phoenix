import {
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
