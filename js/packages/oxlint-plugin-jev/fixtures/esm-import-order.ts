import { register } from "@arizeai/phoenix-otel";
import OpenAI from "openai";

register({ projectName: "esm-import-order", batch: false });

// OpenAI was hoisted above register() and nothing calls manuallyInstrument():
// these calls will not be traced.
export const client = new OpenAI();
