/**
 * @generated SignedSource<<03812852687a08d6acc62d5ee9ac312e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DocumentEvaluationSummaryQuery$variables = {
  evaluationName: string;
  id: string;
};
export type DocumentEvaluationSummaryQuery$data = {
  readonly project: {
    readonly " $fragmentSpreads": FragmentRefs<"DocumentEvaluationSummaryValueFragment">;
  };
};
export type DocumentEvaluationSummaryQuery = {
  response: DocumentEvaluationSummaryQuery$data;
  variables: DocumentEvaluationSummaryQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "evaluationName"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = [
  {
    "kind": "Variable",
    "name": "evaluationName",
    "variableName": "evaluationName"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DocumentEvaluationSummaryQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "args": (v2/*: any*/),
            "kind": "FragmentSpread",
            "name": "DocumentEvaluationSummaryValueFragment"
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "DocumentEvaluationSummaryQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "__typename",
            "storageKey": null
          },
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          },
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v2/*: any*/),
                "concreteType": "DocumentEvaluationSummary",
                "kind": "LinkedField",
                "name": "documentEvaluationSummary",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "averageNdcg",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "averagePrecision",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "meanReciprocalRank",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "hitRate",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Project",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "cb9a115c548038fe9e6d8f82ee295bc6",
    "id": null,
    "metadata": {},
    "name": "DocumentEvaluationSummaryQuery",
    "operationKind": "query",
    "text": "query DocumentEvaluationSummaryQuery(\n  $evaluationName: String!\n  $id: GlobalID!\n) {\n  project: node(id: $id) {\n    __typename\n    ...DocumentEvaluationSummaryValueFragment_qsFcK\n    __isNode: __typename\n    id\n  }\n}\n\nfragment DocumentEvaluationSummaryValueFragment_qsFcK on Project {\n  documentEvaluationSummary(evaluationName: $evaluationName) {\n    averageNdcg\n    averagePrecision\n    meanReciprocalRank\n    hitRate\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "e640f629267b8990db5f218c0f04fdca";

export default node;
