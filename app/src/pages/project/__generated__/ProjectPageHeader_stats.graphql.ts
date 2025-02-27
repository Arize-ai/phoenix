/**
 * @generated SignedSource<<bbcb7bd2a35dccc26420a83a2331f935>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectPageHeader_stats$data = {
  readonly documentEvaluationNames: ReadonlyArray<string>;
  readonly id: string;
  readonly latencyMsP50: number | null;
  readonly latencyMsP99: number | null;
  readonly spanAnnotationNames: ReadonlyArray<string>;
  readonly tokenCountCompletion: number;
  readonly tokenCountPrompt: number;
  readonly tokenCountTotal: number;
  readonly traceCount: number;
  readonly " $fragmentType": "ProjectPageHeader_stats";
};
export type ProjectPageHeader_stats$key = {
  readonly " $data"?: ProjectPageHeader_stats$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectPageHeader_stats">;
};

import ProjectPageHeaderQuery_graphql from './ProjectPageHeaderQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v1 = [
  (v0/*: any*/)
];
return {
  "argumentDefinitions": [
    {
      "kind": "RootArgument",
      "name": "timeRange"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [
        "node"
      ],
      "operation": ProjectPageHeaderQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "ProjectPageHeader_stats",
  "selections": [
    {
      "alias": null,
      "args": (v1/*: any*/),
      "kind": "ScalarField",
      "name": "traceCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": (v1/*: any*/),
      "kind": "ScalarField",
      "name": "tokenCountTotal",
      "storageKey": null
    },
    {
      "alias": null,
      "args": (v1/*: any*/),
      "kind": "ScalarField",
      "name": "tokenCountPrompt",
      "storageKey": null
    },
    {
      "alias": null,
      "args": (v1/*: any*/),
      "kind": "ScalarField",
      "name": "tokenCountCompletion",
      "storageKey": null
    },
    {
      "alias": "latencyMsP50",
      "args": [
        {
          "kind": "Literal",
          "name": "probability",
          "value": 0.5
        },
        (v0/*: any*/)
      ],
      "kind": "ScalarField",
      "name": "latencyMsQuantile",
      "storageKey": null
    },
    {
      "alias": "latencyMsP99",
      "args": [
        {
          "kind": "Literal",
          "name": "probability",
          "value": 0.99
        },
        (v0/*: any*/)
      ],
      "kind": "ScalarField",
      "name": "latencyMsQuantile",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "spanAnnotationNames",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "documentEvaluationNames",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};
})();

(node as any).hash = "e110b84031cc6bfa6bb37751b9c69765";

export default node;
