/**
 * @generated SignedSource<<292a041e55cc77ba6bf4f9a2a7e1da50>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ExperimentDetailsDialogJobErrorsQuery$variables = {
  errorsAfter?: string | null;
  errorsFirst?: number | null;
  id: string;
};
export type ExperimentDetailsDialogJobErrorsQuery$data = {
  readonly node: {
    readonly " $fragmentSpreads": FragmentRefs<"ExperimentDetailsDialog_jobErrors">;
  };
};
export type ExperimentDetailsDialogJobErrorsQuery = {
  response: ExperimentDetailsDialogJobErrorsQuery$data;
  variables: ExperimentDetailsDialogJobErrorsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "errorsAfter"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "errorsFirst"
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
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = [
  {
    "kind": "Variable",
    "name": "after",
    "variableName": "errorsAfter"
  },
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "errorsFirst"
  }
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "stackTrace",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "workItem",
  "plural": false,
  "selections": [
    (v2/*: any*/),
    {
      "kind": "InlineFragment",
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "datasetExampleId",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "repetitionNumber",
          "storageKey": null
        }
      ],
      "type": "TaskWorkItemId",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "experimentRunId",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "datasetEvaluatorId",
          "storageKey": null
        }
      ],
      "type": "EvalWorkItemId",
      "abstractKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ExperimentDetailsDialogJobErrorsQuery",
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
            "args": null,
            "kind": "FragmentSpread",
            "name": "ExperimentDetailsDialog_jobErrors"
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
    "name": "ExperimentDetailsDialogJobErrorsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v4/*: any*/),
                "concreteType": "ExperimentErrorConnection",
                "kind": "LinkedField",
                "name": "errors",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentErrorEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "ExperimentError",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v3/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "occurredAt",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "category",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "message",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "detail",
                            "plural": false,
                            "selections": [
                              (v2/*: any*/),
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "errorType",
                                    "storageKey": null
                                  },
                                  (v5/*: any*/),
                                  (v6/*: any*/)
                                ],
                                "type": "FailureDetail",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "retryCount",
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "reason",
                                    "storageKey": null
                                  },
                                  (v5/*: any*/),
                                  (v6/*: any*/)
                                ],
                                "type": "RetriesExhaustedDetail",
                                "abstractKey": null
                              }
                            ],
                            "storageKey": null
                          },
                          (v2/*: any*/)
                        ],
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "cursor",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PageInfo",
                    "kind": "LinkedField",
                    "name": "pageInfo",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "hasNextPage",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "endCursor",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": (v4/*: any*/),
                "filters": null,
                "handle": "connection",
                "key": "ExperimentDetailsDialog_errors",
                "kind": "LinkedHandle",
                "name": "errors"
              }
            ],
            "type": "ExperimentJob",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "eb04dfb921b8566370dd3181f536a7cf",
    "id": null,
    "metadata": {},
    "name": "ExperimentDetailsDialogJobErrorsQuery",
    "operationKind": "query",
    "text": "query ExperimentDetailsDialogJobErrorsQuery(\n  $errorsAfter: String\n  $errorsFirst: Int\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...ExperimentDetailsDialog_jobErrors\n    id\n  }\n}\n\nfragment ExperimentDetailsDialog_jobErrors on ExperimentJob {\n  errors(first: $errorsFirst, after: $errorsAfter) {\n    edges {\n      node {\n        id\n        occurredAt\n        category\n        message\n        detail {\n          __typename\n          ... on FailureDetail {\n            errorType\n            stackTrace\n            workItem {\n              __typename\n              ... on TaskWorkItemId {\n                datasetExampleId\n                repetitionNumber\n              }\n              ... on EvalWorkItemId {\n                experimentRunId\n                datasetEvaluatorId\n              }\n            }\n          }\n          ... on RetriesExhaustedDetail {\n            retryCount\n            reason\n            stackTrace\n            workItem {\n              __typename\n              ... on TaskWorkItemId {\n                datasetExampleId\n                repetitionNumber\n              }\n              ... on EvalWorkItemId {\n                experimentRunId\n                datasetEvaluatorId\n              }\n            }\n          }\n        }\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "27922b925fc0d1d2d6de2f340ffcd3fc";

export default node;
