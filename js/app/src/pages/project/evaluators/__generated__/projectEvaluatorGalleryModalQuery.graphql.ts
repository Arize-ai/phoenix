/**
 * @generated SignedSource<<1d108fd033085a5646c7d4a3d33cacf9>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EvaluatorCategory = "AGENTS" | "GROUNDING_AND_RETRIEVAL" | "RESPONSE_QUALITY" | "SAFETY_AND_SECURITY" | "USER_EXPERIENCE";
export type EvaluatorScope = "SESSION" | "SPAN" | "TRACE";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type projectEvaluatorGalleryModalQuery$variables = {
  projectId: string;
};
export type projectEvaluatorGalleryModalQuery$data = {
  readonly evaluatorGalleryConfigs: ReadonlyArray<{
    readonly category: EvaluatorCategory | null;
    readonly choices: any;
    readonly defaultFilterCondition: string | null;
    readonly defaultPathMapping: any | null;
    readonly description: string | null;
    readonly details: string | null;
    readonly inputs: ReadonlyArray<{
      readonly description: string;
      readonly name: string;
    }> | null;
    readonly messages: ReadonlyArray<{
      readonly " $fragmentSpreads": FragmentRefs<"promptUtils_promptMessages">;
    }>;
    readonly name: string;
    readonly optimizationDirection: OptimizationDirection;
    readonly scope: EvaluatorScope | null;
  }>;
  readonly evaluators: {
    readonly edges: ReadonlyArray<{
      readonly evaluator: {
        readonly __typename: string;
        readonly description: string | null;
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
};
export type projectEvaluatorGalleryModalQuery = {
  response: projectEvaluatorGalleryModalQuery$data;
  variables: projectEvaluatorGalleryModalQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "projectId"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "choices",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "scope",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "category",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "details",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "concreteType": "EvaluatorInput",
  "kind": "LinkedField",
  "name": "inputs",
  "plural": true,
  "selections": [
    (v1/*:: as any*/),
    (v2/*:: as any*/)
  ],
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "defaultFilterCondition",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "defaultPathMapping",
  "storageKey": null
},
v11 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "TextContentValue",
      "kind": "LinkedField",
      "name": "text",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "text",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "TextContentPart",
  "abstractKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "role",
  "storageKey": null
},
v13 = {
  "kind": "Variable",
  "name": "excludeProjectId",
  "variableName": "projectId"
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v16 = {
  "alias": "evaluator",
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "node",
  "plural": false,
  "selections": [
    (v14/*:: as any*/),
    (v15/*:: as any*/),
    (v1/*:: as any*/),
    (v2/*:: as any*/)
  ],
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cursor",
  "storageKey": null
},
v18 = {
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
v19 = [
  (v13/*:: as any*/),
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
  },
  {
    "kind": "Literal",
    "name": "sort",
    "value": {
      "col": "updatedAt",
      "dir": "desc"
    }
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "projectEvaluatorGalleryModalQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "ClassificationEvaluatorConfig",
        "kind": "LinkedField",
        "name": "evaluatorGalleryConfigs",
        "plural": true,
        "selections": [
          (v1/*:: as any*/),
          (v2/*:: as any*/),
          (v3/*:: as any*/),
          (v4/*:: as any*/),
          (v5/*:: as any*/),
          (v6/*:: as any*/),
          (v7/*:: as any*/),
          (v8/*:: as any*/),
          (v9/*:: as any*/),
          (v10/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "PromptMessage",
            "kind": "LinkedField",
            "name": "messages",
            "plural": true,
            "selections": [
              {
                "kind": "InlineDataFragmentSpread",
                "name": "promptUtils_promptMessages",
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "content",
                    "plural": true,
                    "selections": [
                      (v11/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  (v12/*:: as any*/)
                ],
                "args": null,
                "argumentDefinitions": []
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": "evaluators",
        "args": [
          (v13/*:: as any*/)
        ],
        "concreteType": "EvaluatorConnection",
        "kind": "LinkedField",
        "name": "__ProjectEvaluatorGallery__evaluators_connection",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "EvaluatorEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              (v16/*:: as any*/),
              (v17/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v14/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          (v18/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "projectEvaluatorGalleryModalQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "ClassificationEvaluatorConfig",
        "kind": "LinkedField",
        "name": "evaluatorGalleryConfigs",
        "plural": true,
        "selections": [
          (v1/*:: as any*/),
          (v2/*:: as any*/),
          (v3/*:: as any*/),
          (v4/*:: as any*/),
          (v5/*:: as any*/),
          (v6/*:: as any*/),
          (v7/*:: as any*/),
          (v8/*:: as any*/),
          (v9/*:: as any*/),
          (v10/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "PromptMessage",
            "kind": "LinkedField",
            "name": "messages",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "content",
                "plural": true,
                "selections": [
                  (v14/*:: as any*/),
                  (v11/*:: as any*/)
                ],
                "storageKey": null
              },
              (v12/*:: as any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v19/*:: as any*/),
        "concreteType": "EvaluatorConnection",
        "kind": "LinkedField",
        "name": "evaluators",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "EvaluatorEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              (v16/*:: as any*/),
              (v17/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v14/*:: as any*/),
                  (v15/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          (v18/*:: as any*/)
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v19/*:: as any*/),
        "filters": [
          "excludeProjectId"
        ],
        "handle": "connection",
        "key": "ProjectEvaluatorGallery__evaluators",
        "kind": "LinkedHandle",
        "name": "evaluators"
      }
    ]
  },
  "params": {
    "cacheID": "75758c79b690a9eded9a55967caebe90",
    "id": null,
    "metadata": {
      "connection": [
        {
          "count": null,
          "cursor": null,
          "direction": "forward",
          "path": [
            "evaluators"
          ]
        }
      ]
    },
    "name": "projectEvaluatorGalleryModalQuery",
    "operationKind": "query",
    "text": "query projectEvaluatorGalleryModalQuery(\n  $projectId: ID!\n) {\n  evaluatorGalleryConfigs {\n    name\n    description\n    choices\n    optimizationDirection\n    scope\n    category\n    details\n    inputs {\n      name\n      description\n    }\n    defaultFilterCondition\n    defaultPathMapping\n    messages {\n      ...promptUtils_promptMessages\n    }\n  }\n  evaluators(first: 100, sort: {col: updatedAt, dir: desc}, excludeProjectId: $projectId) {\n    edges {\n      evaluator: node {\n        __typename\n        id\n        name\n        description\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment promptUtils_promptMessages on PromptMessage {\n  content {\n    __typename\n    ... on TextContentPart {\n      text {\n        text\n      }\n    }\n  }\n  role\n}\n"
  }
};
})();

(node as any).hash = "83e2482bcf7e5c287500aecf32c40425";

export default node;
