/**
 * @generated SignedSource<<53bd3f94fde2c3472d634675676ad608>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type AnnotatorKind = "CODE" | "HUMAN" | "LLM";
import { FragmentRefs } from "relay-runtime";
export type ConnectedDetailPanelAnnotationBarTraceAnnotationFields$data = {
  readonly annotatorKind: AnnotatorKind;
  readonly createdAt: string;
  readonly explanation: string | null;
  readonly id: string;
  readonly label: string | null;
  readonly name: string;
  readonly score: number | null;
  readonly user: {
    readonly id: string;
    readonly profilePictureUrl: string | null;
    readonly username: string;
  } | null;
  readonly " $fragmentType": "ConnectedDetailPanelAnnotationBarTraceAnnotationFields";
};
export type ConnectedDetailPanelAnnotationBarTraceAnnotationFields$key = {
  readonly " $data"?: ConnectedDetailPanelAnnotationBarTraceAnnotationFields$data;
  readonly " $fragmentSpreads": FragmentRefs<"ConnectedDetailPanelAnnotationBarTraceAnnotationFields">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "ConnectedDetailPanelAnnotationBarTraceAnnotationFields"
};

(node as any).hash = "b7ee90adddb322e14c36c3f33291f917";

export default node;
