import type { AnnotationConfig } from "@phoenix/pages/settings/types";

export type {
  AnnotationConfig,
  AnnotationConfigCategorical,
  AnnotationConfigContinuous,
  AnnotationConfigFreeform,
} from "@phoenix/pages/settings/types";

export type AnnotationSource = "API" | "APP";
export type AnnotatorKind = "CODE" | "HUMAN" | "LLM";

export interface Annotation {
  id?: string;
  identifier?: string;
  name: string;
  label?: string | null;
  score?: number | null;
  explanation?: string | null;
  metadata?: Record<string, unknown>;
  annotatorKind?: AnnotatorKind;
  source?: AnnotationSource;
  createdAt?: string;
  updatedAt?: string;
  user?: {
    username: string;
    profilePictureUrl?: string | null;
  } | null;
}

export type AnnotationInputPropsBase<T extends AnnotationConfig> = {
  annotation?: Annotation;
  annotationConfig: T;
  onSubmitExplanation?: (explanation: string) => void;
};

export type AnnotationDisplayPreference =
  | "label"
  | "score"
  | "score-and-label"
  | "none";
