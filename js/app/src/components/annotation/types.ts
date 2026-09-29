import type { AnnotationConfig } from "@phoenix/pages/settings/types";

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
  annotatorKind?: string;
  createdAt?: string;
  updatedAt?: string;
  user?: {
    username: string;
    profilePictureUrl?: string | null;
  } | null;
}

export type AnnotationTargetType = "span" | "trace" | "session";

/**
 * The per-name summary the API reports for a span, trace or session: the
 * mean of its scores and how its labels are split.
 */
export type AnnotationSummary = {
  name: string;
  meanScore?: number | null;
  labelFractions: readonly { label: string; fraction: number }[];
  /** How many annotations carry this name. Absent where the API omits it. */
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
