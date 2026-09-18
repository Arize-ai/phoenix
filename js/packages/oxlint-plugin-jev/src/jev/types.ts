/**
 * Wire types for TypeSafe's System One endpoint
 * (`POST https://api.typesafe.ai/v1/systemone`). Kept local so the plugin has
 * no runtime dependency; the shapes mirror `@typesafe-ai/sdk` 0.6.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type EntryType = JsonValue;

export interface NoulQuestion {
  type: "noul";
  instructions: EntryType;
  criteria?: { true?: EntryType; false?: EntryType };
}

export interface ChoiceQuestion {
  type: "choice";
  instructions: EntryType;
  criteria: Record<string, EntryType>;
}

export interface ScoreQuestion {
  type: "score";
  instructions: EntryType;
  criteria: EntryType[];
}

export type Question = NoulQuestion | ChoiceQuestion | ScoreQuestion;

export interface SystemOneRequest {
  model: string;
  state: EntryType;
  questions: Record<string, Question>;
}

export interface NoulAnswer {
  type: "noul";
  noul: number;
}
export interface ChoiceAnswer {
  type: "choice";
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
}
export interface ScoreAnswer {
  type: "score";
  score: number;
  confidence: number;
  probabilities: Record<string, number>;
  legend?: Record<string, EntryType>;
}
export type Answer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

export interface SystemOneResponse {
  model: string;
  answers: Record<string, Answer>;
  usage?: { input_tokens: number; output_tokens: number };
}

export const DEFAULT_BASE_URL = "https://api.typesafe.ai";
export const DEFAULT_MODEL = "jev-latest";
export const API_KEY_ENV = "TYPESAFE_API_KEY";
