/**
 * @generated SignedSource<<f80e9ae304a20306b5d4b85ec3677328>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type AnnotationSource = "API" | "APP";
export type AnnotatorKind = "CODE" | "HUMAN" | "LLM";
import { FragmentRefs } from "relay-runtime";
export type ConnectedDetailPanelAnnotationBarAnnotationFields$data = {
  readonly annotatorKind: AnnotatorKind;
  readonly createdAt: string;
  readonly explanation: string | null;
  readonly id?: string;
  readonly identifier: string;
  readonly label: string | null;
  readonly metadata: any;
  readonly name: string;
  readonly score: number | null;
  readonly source: AnnotationSource;
  readonly updatedAt: string;
  readonly user: {
    readonly id: string;
    readonly profilePictureUrl: string | null;
    readonly username: string;
  } | null;
  readonly " $fragmentType": "ConnectedDetailPanelAnnotationBarAnnotationFields";
};
export type ConnectedDetailPanelAnnotationBarAnnotationFields$key = {
  readonly " $data"?: ConnectedDetailPanelAnnotationBarAnnotationFields$data;
  readonly " $fragmentSpreads": FragmentRefs<"ConnectedDetailPanelAnnotationBarAnnotationFields">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "ConnectedDetailPanelAnnotationBarAnnotationFields"
};

(node as any).hash = "be39fad7b2896caf5d6c5208eaff1b1b";

export default node;
