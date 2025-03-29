import {
  AnnotationConfigTableFragment$data,
  AnnotationType,
} from "@phoenix/pages/settings/__generated__/AnnotationConfigTableFragment.graphql";
import { Mutable } from "@phoenix/typeUtils";

export type AnnotationConfigBase = Mutable<
  AnnotationConfigTableFragment$data["annotationConfigs"]["edges"][number]["annotationConfig"]
> & { name: string; annotationType: AnnotationType };

export type AnnotationConfigContinuous = Pick<
  AnnotationConfigBase,
  | "id"
  | "name"
  | "description"
  | "optimizationDirection"
  | "upperBound"
  | "lowerBound"
> & { annotationType: "CONTINUOUS" };

export type AnnotationConfigCategorical = Pick<
  AnnotationConfigBase,
  "id" | "name" | "description" | "optimizationDirection" | "values"
> & { annotationType: "CATEGORICAL" };

export type AnnotationConfigFreeform = Pick<
  AnnotationConfigBase,
  "id" | "name" | "description"
> & { annotationType: "FREEFORM" };

export type AnnotationConfigType = NonNullable<
  AnnotationConfigBase["annotationType"]
>;

export type AnnotationConfigOptimizationDirection = NonNullable<
  AnnotationConfigBase["optimizationDirection"]
>;

export type AnnotationConfig =
  | AnnotationConfigContinuous
  | AnnotationConfigCategorical
  | AnnotationConfigFreeform;
