/**
 * @generated SignedSource<<1f3ec13ef6d112317abeb98e35506b7e>>
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
export type EvaluatorSlotQuery$variables = {
  filter?: EvaluatorFilter | null;
};
export type EvaluatorSlotQuery$data = {
  readonly evaluators: {
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
export type EvaluatorSlotQuery = {
  response: EvaluatorSlotQuery$data;
  variables: EvaluatorSlotQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "filter"
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
    "name": "EvaluatorSlotQuery",
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
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "EvaluatorSlotQuery",
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
  },
  "params": {
    "cacheID": "8229bad49093288bbe5eb811b89bc300",
    "id": null,
    "metadata": {},
    "name": "EvaluatorSlotQuery",
    "operationKind": "query",
    "text": "query EvaluatorSlotQuery(\n  $filter: EvaluatorFilter\n) {\n  evaluators(first: 50, filter: $filter) {\n    edges {\n      node {\n        __typename\n        id\n        name\n        kind\n        isBuiltin\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "180627d2dc37b9ebf5d14bec88bcedb9";

export default node;
