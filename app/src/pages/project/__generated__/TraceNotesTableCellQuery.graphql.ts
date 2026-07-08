/**
 * @generated SignedSource<<b619efb6bdecc82970276b4e8bf19835>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type TraceNotesTableCellQuery$variables = {
  traceId: string;
};
export type TraceNotesTableCellQuery$data = {
  readonly trace: {
    readonly __typename: "Trace";
    readonly traceAnnotations: ReadonlyArray<{
      readonly createdAt: string;
      readonly explanation: string | null;
      readonly id: string;
      readonly user: {
        readonly username: string;
      } | null;
    }>;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type TraceNotesTableCellQuery = {
  response: TraceNotesTableCellQuery$data;
  variables: TraceNotesTableCellQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "traceId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "traceId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v3 = [
  {
    "kind": "Literal",
    "name": "filter",
    "value": {
      "include": {
        "names": [
          "note"
        ]
      }
    }
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "explanation",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "username",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "TraceNotesTableCellQuery",
    "selections": [
      {
        "alias": "trace",
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
                "alias": null,
                "args": (v3/*: any*/),
                "concreteType": "TraceAnnotation",
                "kind": "LinkedField",
                "name": "traceAnnotations",
                "plural": true,
                "selections": [
                  (v4/*: any*/),
                  (v5/*: any*/),
                  (v6/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "User",
                    "kind": "LinkedField",
                    "name": "user",
                    "plural": false,
                    "selections": [
                      (v7/*: any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": "traceAnnotations(filter:{\"include\":{\"names\":[\"note\"]}})"
              }
            ],
            "type": "Trace",
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
    "name": "TraceNotesTableCellQuery",
    "selections": [
      {
        "alias": "trace",
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
                "alias": null,
                "args": (v3/*: any*/),
                "concreteType": "TraceAnnotation",
                "kind": "LinkedField",
                "name": "traceAnnotations",
                "plural": true,
                "selections": [
                  (v4/*: any*/),
                  (v5/*: any*/),
                  (v6/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "User",
                    "kind": "LinkedField",
                    "name": "user",
                    "plural": false,
                    "selections": [
                      (v7/*: any*/),
                      (v4/*: any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": "traceAnnotations(filter:{\"include\":{\"names\":[\"note\"]}})"
              }
            ],
            "type": "Trace",
            "abstractKey": null
          },
          (v4/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "a9a0595a10a9ec3fa3d98b4860d968fa",
    "id": null,
    "metadata": {},
    "name": "TraceNotesTableCellQuery",
    "operationKind": "query",
    "text": "query TraceNotesTableCellQuery(\n  $traceId: ID!\n) {\n  trace: node(id: $traceId) {\n    __typename\n    ... on Trace {\n      traceAnnotations(filter: {include: {names: [\"note\"]}}) {\n        id\n        explanation\n        createdAt\n        user {\n          username\n          id\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "21fa0362588a39926dbeba62077ea2fb";

export default node;
