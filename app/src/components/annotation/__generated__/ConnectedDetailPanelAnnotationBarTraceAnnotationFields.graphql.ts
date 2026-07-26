/**
 * @generated SignedSource<<f6980129ca666c9c160bcf145487a722>>
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

(node as any).hash = "6e3d474bb7316107be3815446c62aeb5";

export default node;
