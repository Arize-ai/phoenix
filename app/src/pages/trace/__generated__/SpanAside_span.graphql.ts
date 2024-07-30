/**
 * @generated SignedSource<<14c81412604c26fb24d0f446ee24402d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment, RefetchableFragment } from 'relay-runtime';
export type SpanStatusCode = "ERROR" | "OK" | "UNSET";
import { FragmentRefs } from "relay-runtime";
export type SpanAside_span$data = {
  readonly code: SpanStatusCode;
  readonly endTime: string | null;
  readonly id: string;
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

const node: ReaderFragment = {
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
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
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
    }
  ],
  "type": "Span",
  "abstractKey": null
};

(node as any).hash = "37b6d5584933520677f8fcb68c0e5810";

export default node;
