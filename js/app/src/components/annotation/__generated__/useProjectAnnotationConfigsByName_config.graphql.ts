/**
 * @generated SignedSource<<a4099410e8c28acb865d71f749c93254>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type AnnotationType = "CATEGORICAL" | "CONTINUOUS" | "FREEFORM";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
import { FragmentRefs } from "relay-runtime";
export type useProjectAnnotationConfigsByName_config$data = {
  readonly annotationType: AnnotationType;
  readonly lowerBound?: number | null;
  readonly name: string;
  readonly optimizationDirection?: OptimizationDirection;
  readonly threshold?: number | null;
  readonly upperBound?: number | null;
  readonly values?: ReadonlyArray<{
    readonly label: string;
    readonly score: number | null;
  }>;
  readonly " $fragmentType": "useProjectAnnotationConfigsByName_config";
};
export type useProjectAnnotationConfigsByName_config$key = {
  readonly " $data"?: useProjectAnnotationConfigsByName_config$data;
  readonly " $fragmentSpreads": FragmentRefs<"useProjectAnnotationConfigsByName_config">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "useProjectAnnotationConfigsByName_config"
};

(node as any).hash = "9551d5796ad16d59d5495ed0084047bf";

export default node;
