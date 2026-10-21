import type { AnnotationConfig } from "@phoenix/pages/settings/types";

import type { DecisionAnnotation } from "./decisionAnnotation";

export type {
  AnnotationConfig,
  AnnotationConfigCategorical,
  AnnotationConfigContinuous,
  AnnotationConfigFreeform,
} from "@phoenix/pages/settings/types";

export interface Annotation {
  id?: string;
  name: string;
  label?: string | null;
  score?: number | null;
  explanation?: string | null;
  metadata?: Record<string, unknown>;
  /** A decision evaluator's typed result, for experiment-run annotations */
  decision?: DecisionAnnotation | null;
  annotatorKind?: string;
  createdAt?: string;
  updatedAt?: string;
  user?: {
    username: string;
    profilePictureUrl?: string | null;
  } | null;
}

export type AnnotationTargetType = "span" | "trace" | "session";

export type AnnotationSummary = {
  name: string;
  meanScore?: number | null;
  labelFractions: readonly { label: string; fraction: number }[];
  count?: number | null;
};

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
