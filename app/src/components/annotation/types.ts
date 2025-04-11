export type {
  AnnotationConfig,
  AnnotationConfigCategorical,
  AnnotationConfigContinuous,
  AnnotationConfigFreeform,
} from "@phoenix/pages/settings/types";

export interface Annotation {
  name: string;
  label?: string | null;
  score?: number | null;
  explanation?: string | null;
  annotatorKind?: string;
}
