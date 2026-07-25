/**
 * @generated SignedSource<<faa59f145cb07bf7d09112666c386aaf>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type AnnotationType = "CATEGORICAL" | "CONTINUOUS" | "FREEFORM";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
import { FragmentRefs } from "relay-runtime";
export type ConnectedDetailPanelAnnotationBarConfigFields$data = {
  readonly __typename: string;
  readonly annotationType: AnnotationType;
  readonly description: string | null;
  readonly id?: string;
  readonly lowerBound?: number | null;
  readonly name: string;
  readonly optimizationDirection?: OptimizationDirection;
  readonly threshold?: number | null;
  readonly upperBound?: number | null;
  readonly values?: ReadonlyArray<{
    readonly label: string;
    readonly score: number | null;
  }>;
  readonly " $fragmentType": "ConnectedDetailPanelAnnotationBarConfigFields";
};
export type ConnectedDetailPanelAnnotationBarConfigFields$key = {
  readonly " $data"?: ConnectedDetailPanelAnnotationBarConfigFields$data;
  readonly " $fragmentSpreads": FragmentRefs<"ConnectedDetailPanelAnnotationBarConfigFields">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "ConnectedDetailPanelAnnotationBarConfigFields"
};

(node as any).hash = "a3426ff3e5efd82273489bafd22465e9";

export default node;
