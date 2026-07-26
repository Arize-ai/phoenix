import type {
  AnnotationSource,
  AnnotatorKind,
} from "@phoenix/components/annotation/types";

export type AnnotationValueDraft = {
  annotatorKind: AnnotatorKind;
  explanation: string;
  label: string | null;
  metadata: Record<string, unknown>;
  score: number | null;
  source: AnnotationSource;
};
