/**
 * @generated SignedSource<<8a70b058b1df6d70c35b14c9be64c12a>>
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
export type projectEvaluatorTemplatesQuery$variables = Record<PropertyKey, never>;
export type projectEvaluatorTemplatesQuery$data = {
  readonly evaluatorGalleryConfigs: ReadonlyArray<{
    readonly category: EvaluatorCategory | null;
    readonly choices: any;
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
};
export type projectEvaluatorTemplatesQuery = {
  response: projectEvaluatorTemplatesQuery$data;
  variables: projectEvaluatorTemplatesQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "choices",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "scope",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "category",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "details",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "concreteType": "EvaluatorInput",
  "kind": "LinkedField",
  "name": "inputs",
  "plural": true,
  "selections": [
    (v0/*:: as any*/),
    (v1/*:: as any*/)
  ],
  "storageKey": null
},
v8 = {
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
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "role",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "projectEvaluatorTemplatesQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "ClassificationEvaluatorConfig",
        "kind": "LinkedField",
        "name": "evaluatorGalleryConfigs",
        "plural": true,
        "selections": [
          (v0/*:: as any*/),
          (v1/*:: as any*/),
          (v2/*:: as any*/),
          (v3/*:: as any*/),
          (v4/*:: as any*/),
          (v5/*:: as any*/),
          (v6/*:: as any*/),
          (v7/*:: as any*/),
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
                      (v8/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  (v9/*:: as any*/)
                ],
                "args": null,
                "argumentDefinitions": []
              }
            ],
            "storageKey": null
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
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "projectEvaluatorTemplatesQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "ClassificationEvaluatorConfig",
        "kind": "LinkedField",
        "name": "evaluatorGalleryConfigs",
        "plural": true,
        "selections": [
          (v0/*:: as any*/),
          (v1/*:: as any*/),
          (v2/*:: as any*/),
          (v3/*:: as any*/),
          (v4/*:: as any*/),
          (v5/*:: as any*/),
          (v6/*:: as any*/),
          (v7/*:: as any*/),
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
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "__typename",
                    "storageKey": null
                  },
                  (v8/*:: as any*/)
                ],
                "storageKey": null
              },
              (v9/*:: as any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "35fa7efa168c88d02a2ea034d5c720e5",
    "id": null,
    "metadata": {},
    "name": "projectEvaluatorTemplatesQuery",
    "operationKind": "query",
    "text": "query projectEvaluatorTemplatesQuery {\n  evaluatorGalleryConfigs {\n    name\n    description\n    choices\n    optimizationDirection\n    scope\n    category\n    details\n    inputs {\n      name\n      description\n    }\n    messages {\n      ...promptUtils_promptMessages\n    }\n  }\n}\n\nfragment promptUtils_promptMessages on PromptMessage {\n  content {\n    __typename\n    ... on TextContentPart {\n      text {\n        text\n      }\n    }\n  }\n  role\n}\n"
  }
};
})();

(node as any).hash = "fde662a46912e3a998226124fcbb54ba";

export default node;
