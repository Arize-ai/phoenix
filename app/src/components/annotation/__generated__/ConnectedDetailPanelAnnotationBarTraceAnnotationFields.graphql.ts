/**
 * @generated SignedSource<<42774b962fdec080d7b28c28095c0d36>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type AnnotationSource = "API" | "APP";
export type AnnotatorKind = "CODE" | "HUMAN" | "LLM";
import { FragmentRefs } from "relay-runtime";
export type ConnectedDetailPanelAnnotationBarTraceAnnotationFields$data = {
  readonly annotatorKind: AnnotatorKind;
  readonly createdAt: string;
  readonly explanation: string | null;
  readonly id: string;
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

(node as any).hash = "243ef4f970539fdf2c656c5caca4e222";

export default node;
