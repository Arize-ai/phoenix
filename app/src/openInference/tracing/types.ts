import { MESSAGE_CONTENT, MESSAGE_ROLE } from "./semanticConventions";

export type AttributeMessage = {
  [MESSAGE_ROLE]: string;
  [MESSAGE_CONTENT]: string;
  [key: string]: unknown;
};
