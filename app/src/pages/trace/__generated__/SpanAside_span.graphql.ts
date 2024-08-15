/**
 * @generated SignedSource<<ebb8ab32330c4b99061aafd8b83bbde0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment, RefetchableFragment } from 'relay-runtime';
export type AnnotatorKind = "HUMAN" | "LLM";
export type SpanStatusCode = "ERROR" | "OK" | "UNSET";
import { FragmentRefs } from "relay-runtime";
export type SpanAside_span$data = {
  readonly code: SpanStatusCode;
  readonly endTime: string | null;
  readonly id: string;
  readonly spanAnnotations: ReadonlyArray<{
    readonly annotatorKind: AnnotatorKind;
    readonly id: string;
    readonly label: string | null;
    readonly name: string;
    readonly score: number | null;
  }>;
  readonly startTime: string;
  readonly tokenCountCompletion: number | null;
  readonly tokenCountPrompt: number | null;
  readonly tokenCountTotal: number | null;
  readonly " $fragmentType": "SpanAside_span";
};
export type SpanAside_span$key = {
  readonly " $data"?: SpanAside_span$data;
  readonly " $fragmentSpreads": FragmentRefs<"SpanAside_span">;
};

import SpanAsideSpanQuery_graphql from './SpanAsideSpanQuery.graphql';

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
      "operation": SpanAsideSpanQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "SpanAside_span",
  "selections": [
    (v0/*: any*/),
    {
      "alias": "code",
      "args": null,
      "kind": "ScalarField",
      "name": "statusCode",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "startTime",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "endTime",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "tokenCountTotal",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "tokenCountPrompt",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "tokenCountCompletion",
      "storageKey": null
    },
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
          "name": "label",
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
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Span",
  "abstractKey": null
};
})();

(node as any).hash = "cb5cab60889623d77ad0c96c98b3f8ac";

export default node;
