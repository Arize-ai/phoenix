/**
 * @generated SignedSource<<348e466f4331af82b687bdbe09f1a5fc>>
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

(node as any).hash = "4f96d547a53a850d779aa95e39eb30b3";

export default node;
