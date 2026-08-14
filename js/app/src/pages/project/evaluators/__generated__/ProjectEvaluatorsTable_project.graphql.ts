/**
 * @generated SignedSource<<3c1690467bc572080dbb176d4933b48d>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorsTable_project$data = {
  readonly evaluators: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorsTable_row">;
      };
    }>;
  };
  readonly id: string;
  readonly " $fragmentType": "ProjectEvaluatorsTable_project";
};
export type ProjectEvaluatorsTable_project$key = {
  readonly " $data"?: ProjectEvaluatorsTable_project$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorsTable_project">;
};

import ProjectEvaluatorsTablePaginationQuery_graphql from './ProjectEvaluatorsTablePaginationQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "evaluators"
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "after"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "filter"
    },
    {
      "defaultValue": 30,
      "kind": "LocalArgument",
      "name": "first"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "first",
        "cursor": "after",
        "direction": "forward",
        "path": (v0/*:: as any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "first",
          "cursor": "after"
        },
        "backward": null,
        "path": (v0/*:: as any*/)
      },
      "fragmentPathInResult": [
        "node"
      ],
      "operation": ProjectEvaluatorsTablePaginationQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "ProjectEvaluatorsTable_project",
  "selections": [
    {
      "alias": "evaluators",
      "args": [
        {
          "kind": "Variable",
          "name": "filter",
          "variableName": "filter"
        }
      ],
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
                    (v1/*:: as any*/),
                    (v2/*:: as any*/),
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
                      "name": "filterCondition",
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
                      "name": "schedulabilityStatus",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "enabled",
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
                                (v1/*:: as any*/),
                                (v2/*:: as any*/)
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
                                (v2/*:: as any*/)
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
                                }
                              ],
                              "storageKey": null
                            }
                          ],
                          "type": "LLMEvaluator",
                          "abstractKey": null
                        },
                        {
                          "kind": "InlineFragment",
                          "selections": [
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "language",
                              "storageKey": null
                            },
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "SandboxConfig",
                              "kind": "LinkedField",
                              "name": "sandboxConfig",
                              "plural": false,
                              "selections": [
                                (v1/*:: as any*/),
                                (v2/*:: as any*/),
                                {
                                  "alias": null,
                                  "args": null,
                                  "concreteType": "SandboxProvider",
                                  "kind": "LinkedField",
                                  "name": "provider",
                                  "plural": false,
                                  "selections": [
                                    {
                                      "alias": null,
                                      "args": null,
                                      "kind": "ScalarField",
                                      "name": "backendType",
                                      "storageKey": null
                                    }
                                  ],
                                  "storageKey": null
                                }
                              ],
                              "storageKey": null
                            }
                          ],
                          "type": "CodeEvaluator",
                          "abstractKey": null
                        }
                      ],
                      "storageKey": null
                    }
                  ],
                  "args": null,
                  "argumentDefinitions": []
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "__typename",
                  "storageKey": null
                }
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
      "storageKey": null
    },
    (v1/*:: as any*/)
  ],
  "type": "Project",
  "abstractKey": null
};
})();

(node as any).hash = "e32f1d4594df375d4292c05d795eecba";

export default node;
