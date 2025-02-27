/**
 * @generated SignedSource<<d5492e64a4c697cfe3e4964b900bfc63>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment, RefetchableFragment } from 'relay-runtime';
export type AnnotatorKind = "HUMAN" | "LLM";
import { FragmentRefs } from "relay-runtime";
export type EditSpanAnnotationsDialog_spanAnnotations$data = {
  readonly id: string;
  readonly spanAnnotations: ReadonlyArray<{
    readonly annotatorKind: AnnotatorKind;
    readonly explanation: string | null;
    readonly id: string;
    readonly label: string | null;
    readonly name: string;
    readonly score: number | null;
  }>;
  readonly " $fragmentType": "EditSpanAnnotationsDialog_spanAnnotations";
};
export type EditSpanAnnotationsDialog_spanAnnotations$key = {
  readonly " $data"?: EditSpanAnnotationsDialog_spanAnnotations$data;
  readonly " $fragmentSpreads": FragmentRefs<"EditSpanAnnotationsDialog_spanAnnotations">;
};

import EditSpanAnnotationsDialogSpanAnnotationsQuery_graphql from './EditSpanAnnotationsDialogSpanAnnotationsQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [
        "node"
      ],
      "operation": EditSpanAnnotationsDialogSpanAnnotationsQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "EditSpanAnnotationsDialog_spanAnnotations",
  "selections": [
    (v0/*: any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "SpanAnnotation",
      "kind": "LinkedField",
      "name": "spanAnnotations",
      "plural": true,
      "selections": [
        (v0/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "name",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "annotatorKind",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "score",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "label",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "explanation",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Span",
  "abstractKey": null
};
})();

(node as any).hash = "07aedb847a2af03a77823f0afc0c98d4";

export default node;
