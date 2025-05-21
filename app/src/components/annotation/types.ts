import { AnnotationConfig } from "@phoenix/pages/settings/types";

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
  annotatorKind?: string;
  createdAt?: string;
  user?: {
    username: string;
    profilePictureUrl?: string | null;
  } | null;
}

export type AnnotationInputPropsBase<T extends AnnotationConfig> = {
  annotation?: Annotation;
  annotationConfig: T;
  containerRef?: HTMLDivElement;
  onSubmitExplanation?: (explanation: string) => void;
};
