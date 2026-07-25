/**
 * @generated SignedSource<<eeff628a8cf07794c5e1477a89d3fcad>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type AnnotatorKind = "CODE" | "HUMAN" | "LLM";
import { FragmentRefs } from "relay-runtime";
export type ConnectedDetailPanelAnnotationBarAnnotationFields$data = {
  readonly annotatorKind: AnnotatorKind;
  readonly createdAt: string;
  readonly explanation: string | null;
  readonly id?: string;
  readonly label: string | null;
  readonly name: string;
  readonly score: number | null;
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

(node as any).hash = "a79669286ad6bde98d01e9e0356b9dd5";

export default node;
