/**
 * @generated SignedSource<<a1bbbb51708f8a899a32e49459785a03>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DecisionsPageQuery$variables = Record<PropertyKey, never>;
export type DecisionsPageQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"DecisionsTable_decisions">;
};
export type DecisionsPageQuery = {
  response: DecisionsPageQuery$data;
  variables: DecisionsPageQuery$variables;
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
    "kind": "ScalarField",
    "name": "username",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "profilePictureUrl",
    "storageKey": null
  },
  (v1/*:: as any*/)
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "DecisionsPageQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "DecisionsTable_decisions"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "DecisionsPageQuery",
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
                    "kind": "ScalarField",
                    "name": "description",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "User",
                    "kind": "LinkedField",
                    "name": "createdBy",
                    "plural": false,
                    "selections": (v3/*:: as any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "User",
                    "kind": "LinkedField",
                    "name": "updatedBy",
                    "plural": false,
                    "selections": (v3/*:: as any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DecisionVersion",
                    "kind": "LinkedField",
                    "name": "version",
                    "plural": false,
                    "selections": [
                      (v1/*:: as any*/),
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
                    "kind": "ScalarField",
                    "name": "versionCount",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DecisionVersionTag",
                    "kind": "LinkedField",
                    "name": "versionTags",
                    "plural": true,
                    "selections": [
                      (v1/*:: as any*/),
                      (v2/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "decisionVersionId",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DecisionLabel",
                    "kind": "LinkedField",
                    "name": "labels",
                    "plural": true,
                    "selections": [
                      (v1/*:: as any*/),
                      (v2/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "color",
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
                "kind": "ScalarField",
                "name": "cursor",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "Decision",
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
                  (v1/*:: as any*/)
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
        "storageKey": "decisions(first:100)"
      },
      {
        "alias": null,
        "args": (v0/*:: as any*/),
        "filters": [
          "filter",
          "labelIds"
        ],
        "handle": "connection",
        "key": "DecisionsTable_decisions",
        "kind": "LinkedHandle",
        "name": "decisions"
      }
    ]
  },
  "params": {
    "cacheID": "bf3c67db8c5ee7819ddef4225e13677d",
    "id": null,
    "metadata": {},
    "name": "DecisionsPageQuery",
    "operationKind": "query",
    "text": "query DecisionsPageQuery {\n  ...DecisionsTable_decisions\n}\n\nfragment DecisionsTable_decisions on Query {\n  decisions(first: 100) {\n    edges {\n      decision: node {\n        id\n        name\n        description\n        createdBy {\n          username\n          profilePictureUrl\n          id\n        }\n        updatedBy {\n          username\n          profilePictureUrl\n          id\n        }\n        version {\n          id\n          createdAt\n          modelName\n          modelProvider\n        }\n        updatedAt\n        versionCount\n        versionTags {\n          id\n          name\n          decisionVersionId\n        }\n        labels {\n          id\n          name\n          color\n        }\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "eafc54afebc3bcbd37b0bbda069326c9";

export default node;
