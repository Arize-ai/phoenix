/**
 * Client-side tool descriptor sent with agent chat requests so the backend can
 * advertise frontend-executable tools to the model.
 */
export type FrontendToolDefinition = {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<
      string,
      {
        type: string;
        description: string;
      }
    >;
    required: string[];
    additionalProperties: boolean;
  };
};
