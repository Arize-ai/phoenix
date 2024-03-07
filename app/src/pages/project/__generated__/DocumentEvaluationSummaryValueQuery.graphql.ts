/**
 * @generated SignedSource<<dde9ececfae1c254c26a9446e77053b4>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DocumentEvaluationSummaryValueQuery$variables = {
  evaluationName: string;
  id: string;
};
export type DocumentEvaluationSummaryValueQuery$data = {
  readonly node: {
    readonly " $fragmentSpreads": FragmentRefs<"DocumentEvaluationSummaryValueFragment">;
  };
};
export type DocumentEvaluationSummaryValueQuery = {
  response: DocumentEvaluationSummaryValueQuery$data;
  variables: DocumentEvaluationSummaryValueQuery$variables;
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
    "name": "DocumentEvaluationSummaryValueQuery",
    "selections": [
      {
        "alias": null,
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
    "name": "DocumentEvaluationSummaryValueQuery",
    "selections": [
      {
        "alias": null,
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
    "cacheID": "19f924354260669fd66200e9a6d5142e",
    "id": null,
    "metadata": {},
    "name": "DocumentEvaluationSummaryValueQuery",
    "operationKind": "query",
    "text": "query DocumentEvaluationSummaryValueQuery(\n  $evaluationName: String!\n  $id: GlobalID!\n) {\n  node(id: $id) {\n    __typename\n    ...DocumentEvaluationSummaryValueFragment_qsFcK\n    __isNode: __typename\n    id\n  }\n}\n\nfragment DocumentEvaluationSummaryValueFragment_qsFcK on Project {\n  documentEvaluationSummary(evaluationName: $evaluationName) {\n    averageNdcg\n    averagePrecision\n    meanReciprocalRank\n    hitRate\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "7ff5a61c190ffed0761777c61a4fb476";

export default node;
