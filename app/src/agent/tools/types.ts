/**
 * A JSON Schema property descriptor. Supports nested objects, arrays, and
 * validation constraints so tool definitions can express rich input schemas.
 */
export type JsonSchemaProperty = {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  items?: JsonSchemaProperty & {
    properties?: Record<string, JsonSchemaProperty>;
    required?: string[];
  };
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  maxItems?: number;
  additionalProperties?: boolean;
};

/**
 * Client-side tool descriptor sent with agent chat requests so the backend can
 * advertise frontend-executable tools to the model.
 */
export type FrontendToolDefinition = {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, JsonSchemaProperty>;
    required: string[];
    additionalProperties?: boolean;
  };
};
