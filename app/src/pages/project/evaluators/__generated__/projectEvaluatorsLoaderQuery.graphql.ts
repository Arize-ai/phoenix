/**
 * @generated SignedSource<<f3d49e5e2e2334426c5842a0b65cbb9d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type projectEvaluatorsLoaderQuery$variables = {
  id: string;
};
export type projectEvaluatorsLoaderQuery$data = {
  readonly project: {
    readonly id: string;
    readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorsTable_evaluators">;
  };
};
export type projectEvaluatorsLoaderQuery = {
  response: projectEvaluatorsLoaderQuery$data;
  variables: projectEvaluatorsLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
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
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v4 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
  }
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "projectEvaluatorsLoaderQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "ProjectEvaluatorsTable_evaluators"
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "projectEvaluatorsLoaderQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v3/*: any*/),
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v4/*: any*/),
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
                          (v2/*: any*/),
                          (v5/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "evaluationTarget",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "samplingRate",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "filterCondition",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "updatedAt",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "evaluator",
                            "plural": false,
                            "selections": [
                              (v3/*: any*/),
                              (v2/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "kind",
                                "storageKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "Prompt",
                                    "kind": "LinkedField",
                                    "name": "prompt",
                                    "plural": false,
                                    "selections": [
                                      (v2/*: any*/),
                                      (v5/*: any*/)
                                    ],
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "PromptVersionTag",
                                    "kind": "LinkedField",
                                    "name": "promptVersionTag",
                                    "plural": false,
                                    "selections": [
                                      (v5/*: any*/),
                                      (v2/*: any*/)
                                    ],
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "PromptVersion",
                                    "kind": "LinkedField",
                                    "name": "promptVersion",
                                    "plural": false,
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "modelName",
                                        "storageKey": null
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "modelProvider",
                                        "storageKey": null
                                      },
                                      (v2/*: any*/)
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "type": "LLMEvaluator",
                                "abstractKey": null
                              }
                            ],
                            "storageKey": null
                          },
                          (v3/*: any*/)
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
                  }
                ],
                "storageKey": "evaluators(first:100)"
              },
              {
                "alias": null,
                "args": (v4/*: any*/),
                "filters": null,
                "handle": "connection",
                "key": "ProjectEvaluatorsTable_evaluators",
                "kind": "LinkedHandle",
                "name": "evaluators"
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
    "cacheID": "e10a7e81262a0b347531bebf7bce9650",
    "id": null,
    "metadata": {},
    "name": "projectEvaluatorsLoaderQuery",
    "operationKind": "query",
    "text": "query projectEvaluatorsLoaderQuery(\n  $id: ID!\n) {\n  project: node(id: $id) {\n    __typename\n    id\n    ... on Project {\n      id\n      ...ProjectEvaluatorsTable_evaluators\n    }\n  }\n}\n\nfragment ProjectEvaluatorsTable_evaluators on Project {\n  evaluators(first: 100) {\n    edges {\n      node {\n        ...ProjectEvaluatorsTable_row\n        id\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n\nfragment ProjectEvaluatorsTable_row on ProjectEvaluator {\n  id\n  name\n  evaluationTarget\n  samplingRate\n  filterCondition\n  updatedAt\n  evaluator {\n    __typename\n    id\n    kind\n    ... on LLMEvaluator {\n      prompt {\n        id\n        name\n      }\n      promptVersionTag {\n        name\n        id\n      }\n      promptVersion {\n        modelName\n        modelProvider\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "a3ad89e5a9cb35341802f88a5a0afc1c";

export default node;
