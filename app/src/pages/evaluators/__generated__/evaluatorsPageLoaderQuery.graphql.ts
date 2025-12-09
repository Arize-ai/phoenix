/**
 * @generated SignedSource<<00903a915b03b2500012a6f4da191dbb>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type evaluatorsPageLoaderQuery$variables = Record<PropertyKey, never>;
export type evaluatorsPageLoaderQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"GlobalEvaluatorsTable_evaluators">;
};
export type evaluatorsPageLoaderQuery = {
  response: evaluatorsPageLoaderQuery$data;
  variables: evaluatorsPageLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
  }
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
},
v3 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "Prompt",
    "kind": "LinkedField",
    "name": "prompt",
    "plural": false,
    "selections": [
      (v1/*: any*/),
      (v2/*: any*/)
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
      (v2/*: any*/),
      (v1/*: any*/)
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "evaluatorsPageLoaderQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "GlobalEvaluatorsTable_evaluators"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "evaluatorsPageLoaderQuery",
    "selections": [
      {
        "alias": null,
        "args": (v0/*: any*/),
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
              {
                "alias": null,
                "args": null,
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
                    "abstractKey": "__isEvaluator"
                  },
                  (v1/*: any*/),
                  (v2/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "kind",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "description",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "createdAt",
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
                    "kind": "InlineFragment",
                    "selections": (v3/*: any*/),
                    "type": "LLMEvaluator",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": (v3/*: any*/),
                    "type": "DatasetLLMEvaluator",
                    "abstractKey": null
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
          },
          {
            "kind": "ClientExtension",
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "__id",
                "storageKey": null
              }
            ]
          }
        ],
        "storageKey": "evaluators(first:100)"
      },
      {
        "alias": null,
        "args": (v0/*: any*/),
        "filters": [
          "sort",
          "filter"
        ],
        "handle": "connection",
        "key": "EvaluatorsTable_evaluators",
        "kind": "LinkedHandle",
        "name": "evaluators"
      }
    ]
  },
  "params": {
    "cacheID": "715b3adb6bd088ce4931aa5848370b3a",
    "id": null,
    "metadata": {},
    "name": "evaluatorsPageLoaderQuery",
    "operationKind": "query",
    "text": "query evaluatorsPageLoaderQuery {\n  ...GlobalEvaluatorsTable_evaluators\n}\n\nfragment EvaluatorsTable_row on Evaluator {\n  __isEvaluator: __typename\n  id\n  name\n  kind\n  description\n  createdAt\n  updatedAt\n  ... on LLMEvaluator {\n    prompt {\n      id\n      name\n    }\n    promptVersionTag {\n      name\n      id\n    }\n  }\n  ... on DatasetLLMEvaluator {\n    prompt {\n      id\n      name\n    }\n    promptVersionTag {\n      name\n      id\n    }\n  }\n}\n\nfragment GlobalEvaluatorsTable_evaluators on Query {\n  evaluators(first: 100) {\n    edges {\n      node {\n        __typename\n        ...EvaluatorsTable_row\n        id\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "53b1973dff23e5476cd644dee57048fb";

export default node;
