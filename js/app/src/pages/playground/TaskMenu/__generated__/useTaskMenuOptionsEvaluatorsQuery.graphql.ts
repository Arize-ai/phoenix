/**
 * @generated SignedSource<<4c5caf3342ad2a2ed685ff7513bb67ce>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluatorFilterColumn = "name";
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type EvaluatorFilter = {
  col: EvaluatorFilterColumn;
  value: string;
};
export type useTaskMenuOptionsEvaluatorsQuery$variables = {
  filter?: EvaluatorFilter | null;
  includeEvaluators: boolean;
};
export type useTaskMenuOptionsEvaluatorsQuery$data = {
  readonly evaluators?: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly id: string;
        readonly isBuiltin: boolean;
        readonly kind: EvaluatorKind;
        readonly name: string;
      };
    }>;
  };
};
export type useTaskMenuOptionsEvaluatorsQuery = {
  response: useTaskMenuOptionsEvaluatorsQuery$data;
  variables: useTaskMenuOptionsEvaluatorsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "filter"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "includeEvaluators"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "filter",
    "variableName": "filter"
  },
  {
    "kind": "Literal",
    "name": "first",
    "value": 50
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
  "name": "name",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "isBuiltin",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useTaskMenuOptionsEvaluatorsQuery",
    "selections": [
      {
        "condition": "includeEvaluators",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": null,
            "args": (v1/*:: as any*/),
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
                      (v2/*:: as any*/),
                      (v3/*:: as any*/),
                      (v4/*:: as any*/),
                      (v5/*:: as any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ]
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "useTaskMenuOptionsEvaluatorsQuery",
    "selections": [
      {
        "condition": "includeEvaluators",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": null,
            "args": (v1/*:: as any*/),
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
                      (v2/*:: as any*/),
                      (v3/*:: as any*/),
                      (v4/*:: as any*/),
                      (v5/*:: as any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ]
      }
    ]
  },
  "params": {
    "cacheID": "a358eb97de15018915db1e99f5ac74db",
    "id": null,
    "metadata": {},
    "name": "useTaskMenuOptionsEvaluatorsQuery",
    "operationKind": "query",
    "text": "query useTaskMenuOptionsEvaluatorsQuery(\n  $filter: EvaluatorFilter\n  $includeEvaluators: Boolean!\n) {\n  evaluators(first: 50, filter: $filter) @include(if: $includeEvaluators) {\n    edges {\n      node {\n        __typename\n        id\n        name\n        kind\n        isBuiltin\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "b49dbbccbfc289011ba02a3c99a5804f";

export default node;
