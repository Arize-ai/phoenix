/**
 * @generated SignedSource<<ab78718931c5d2b126070287a3c9c9f7>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type refetchProjectEvaluatorsQuery$variables = {
  first: number;
  projectId: string;
};
export type refetchProjectEvaluatorsQuery$data = {
  readonly project: {
    readonly evaluators?: {
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorsTable_row">;
        };
      }>;
      readonly pageInfo: {
        readonly endCursor: string | null;
        readonly hasNextPage: boolean;
      };
    };
  };
};
export type refetchProjectEvaluatorsQuery = {
  response: refetchProjectEvaluatorsQuery$data;
  variables: refetchProjectEvaluatorsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "first"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "evaluationTarget",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "filterCondition",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "samplingRate",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "enabled",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cursor",
  "storageKey": null
},
v12 = {
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
      "name": "endCursor",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "hasNextPage",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v13 = [
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "first"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "refetchProjectEvaluatorsQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v2/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": "evaluators",
                "args": null,
                "concreteType": "ProjectEvaluatorConnection",
                "kind": "LinkedField",
                "name": "__ProjectEvaluatorsTable_evaluators_connection",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ProjectEvaluatorEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "ProjectEvaluator",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          {
                            "kind": "InlineDataFragmentSpread",
                            "name": "ProjectEvaluatorsTable_row",
                            "selections": [
                              (v3/*:: as any*/),
                              (v4/*:: as any*/),
                              (v5/*:: as any*/),
                              (v6/*:: as any*/),
                              (v7/*:: as any*/),
                              (v8/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": null,
                                "kind": "LinkedField",
                                "name": "evaluator",
                                "plural": false,
                                "selections": [
                                  (v9/*:: as any*/)
                                ],
                                "storageKey": null
                              }
                            ],
                            "args": null,
                            "argumentDefinitions": []
                          },
                          (v10/*:: as any*/)
                        ],
                        "storageKey": null
                      },
                      (v11/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  (v12/*:: as any*/)
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
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "refetchProjectEvaluatorsQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v2/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v10/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v13/*:: as any*/),
                "concreteType": "ProjectEvaluatorConnection",
                "kind": "LinkedField",
                "name": "evaluators",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ProjectEvaluatorEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "ProjectEvaluator",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v3/*:: as any*/),
                          (v4/*:: as any*/),
                          (v5/*:: as any*/),
                          (v6/*:: as any*/),
                          (v7/*:: as any*/),
                          (v8/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "evaluator",
                            "plural": false,
                            "selections": [
                              (v10/*:: as any*/),
                              (v9/*:: as any*/),
                              (v3/*:: as any*/)
                            ],
                            "storageKey": null
                          },
                          (v10/*:: as any*/)
                        ],
                        "storageKey": null
                      },
                      (v11/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  (v12/*:: as any*/)
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": (v13/*:: as any*/),
                "filters": null,
                "handle": "connection",
                "key": "ProjectEvaluatorsTable_evaluators",
                "kind": "LinkedHandle",
                "name": "evaluators"
              }
            ],
            "type": "Project",
            "abstractKey": null
          },
          (v3/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "2950b46fd20afda08b9dac77a10bd211",
    "id": null,
    "metadata": {
      "connection": [
        {
          "count": "first",
          "cursor": null,
          "direction": "forward",
          "path": [
            "project",
            "evaluators"
          ]
        }
      ]
    },
    "name": "refetchProjectEvaluatorsQuery",
    "operationKind": "query",
    "text": "query refetchProjectEvaluatorsQuery(\n  $projectId: ID!\n  $first: Int!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      evaluators(first: $first) {\n        edges {\n          node {\n            ...ProjectEvaluatorsTable_row\n            id\n            __typename\n          }\n          cursor\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment ProjectEvaluatorsTable_row on ProjectEvaluator {\n  id\n  name\n  evaluationTarget\n  filterCondition\n  samplingRate\n  enabled\n  evaluator {\n    __typename\n    kind\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "34d3e0a98ee7e32588c21b2475ef1c69";

export default node;
