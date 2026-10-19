/**
 * @generated SignedSource<<fbadf50cd2ef39276187f0318acf2e22>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SaveDecisionDialogQuery$variables = Record<PropertyKey, never>;
export type SaveDecisionDialogQuery$data = {
  readonly decisions: {
    readonly edges: ReadonlyArray<{
      readonly decision: {
        readonly id: string;
        readonly name: string;
        readonly versionTags: ReadonlyArray<{
          readonly name: string;
        }>;
      };
    }>;
  };
};
export type SaveDecisionDialogQuery = {
  response: SaveDecisionDialogQuery$data;
  variables: SaveDecisionDialogQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 200
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
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "SaveDecisionDialogQuery",
    "selections": [
      {
        "alias": null,
        "args": (v0/*:: as any*/),
        "concreteType": "DecisionConnection",
        "kind": "LinkedField",
        "name": "decisions",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DecisionEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": "decision",
                "args": null,
                "concreteType": "Decision",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v1/*:: as any*/),
                  (v2/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DecisionVersionTag",
                    "kind": "LinkedField",
                    "name": "versionTags",
                    "plural": true,
                    "selections": [
                      (v2/*:: as any*/)
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
        "storageKey": "decisions(first:200)"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "SaveDecisionDialogQuery",
    "selections": [
      {
        "alias": null,
        "args": (v0/*:: as any*/),
        "concreteType": "DecisionConnection",
        "kind": "LinkedField",
        "name": "decisions",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DecisionEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": "decision",
                "args": null,
                "concreteType": "Decision",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v1/*:: as any*/),
                  (v2/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DecisionVersionTag",
                    "kind": "LinkedField",
                    "name": "versionTags",
                    "plural": true,
                    "selections": [
                      (v2/*:: as any*/),
                      (v1/*:: as any*/)
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
        "storageKey": "decisions(first:200)"
      }
    ]
  },
  "params": {
    "cacheID": "54b7506088aae232491e96f15a338e0c",
    "id": null,
    "metadata": {},
    "name": "SaveDecisionDialogQuery",
    "operationKind": "query",
    "text": "query SaveDecisionDialogQuery {\n  decisions(first: 200) {\n    edges {\n      decision: node {\n        id\n        name\n        versionTags {\n          name\n          id\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "34423865dcfc9c4c1f88ed4c2310efac";

export default node;
