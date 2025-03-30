/**
 * @generated SignedSource<<39c9b6cbfecce15caf9fec3a77b79601>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type AnnotatorKind = "HUMAN" | "LLM";
import { FragmentRefs } from "relay-runtime";
export type SpanAnnotationsEditor_spanAnnotations$data = {
  readonly id: string;
  readonly spanAnnotations: ReadonlyArray<{
    readonly annotatorKind: AnnotatorKind;
    readonly explanation: string | null;
    readonly id: string;
    readonly label: string | null;
    readonly name: string;
    readonly score: number | null;
  }>;
  readonly " $fragmentType": "SpanAnnotationsEditor_spanAnnotations";
};
export type SpanAnnotationsEditor_spanAnnotations$key = {
  readonly " $data"?: SpanAnnotationsEditor_spanAnnotations$data;
  readonly " $fragmentSpreads": FragmentRefs<"SpanAnnotationsEditor_spanAnnotations">;
};

import SpanAnnotationsEditorSpanAnnotationsQuery_graphql from './SpanAnnotationsEditorSpanAnnotationsQuery.graphql';

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
      "operation": SpanAnnotationsEditorSpanAnnotationsQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "SpanAnnotationsEditor_spanAnnotations",
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

(node as any).hash = "346128e2a5b9bceffc9511be191054ef";

export default node;
