/**
 * @generated SignedSource<<7b923b2bf44aecdc3cb3295f95cc662b>>
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
  readonly label: string | null;
  readonly metadata: any;
  readonly name: string;
  readonly score: number | null;
  readonly source: AnnotationSource;
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

(node as any).hash = "35d45666cefa80c0e0ceb63a50f2f452";

export default node;
