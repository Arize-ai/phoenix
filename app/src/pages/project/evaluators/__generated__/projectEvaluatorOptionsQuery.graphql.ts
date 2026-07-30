/**
 * @generated SignedSource<<6d57846e48016fee8f882df5e6fa4e9f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type projectEvaluatorOptionsQuery$variables = Record<PropertyKey, never>;
export type projectEvaluatorOptionsQuery$data = {
  readonly evaluators: {
    readonly edges: ReadonlyArray<{
      readonly evaluator: {
        readonly __typename: string;
        readonly description: string | null;
        readonly id: string;
        readonly kind: EvaluatorKind;
        readonly name: string;
      };
    }>;
    readonly pageInfo: {
      readonly hasNextPage: boolean;
    };
  };
};
export type projectEvaluatorOptionsQuery = {
  response: projectEvaluatorOptionsQuery$data;
  variables: projectEvaluatorOptionsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": [
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
    ],
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
            "alias": "evaluator",
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
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "id",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "name",
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
                "name": "kind",
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
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": "evaluators(first:100,sort:{\"col\":\"updatedAt\",\"dir\":\"desc\"})"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "projectEvaluatorOptionsQuery",
    "selections": (v0/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "projectEvaluatorOptionsQuery",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "b6b53ff6ffeedaa3f44afe42460ded6a",
    "id": null,
    "metadata": {},
    "name": "projectEvaluatorOptionsQuery",
    "operationKind": "query",
    "text": "query projectEvaluatorOptionsQuery {\n  evaluators(first: 100, sort: {col: updatedAt, dir: desc}) {\n    edges {\n      evaluator: node {\n        __typename\n        id\n        name\n        description\n        kind\n      }\n    }\n    pageInfo {\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "54417d2bff99a00e1c54e5ce5fc591ee";

export default node;
