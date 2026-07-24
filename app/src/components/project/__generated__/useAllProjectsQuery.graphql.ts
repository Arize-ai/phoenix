/**
 * @generated SignedSource<<a68eac8adf0fef1661256c02874832fc>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type useAllProjectsQuery$variables = Record<PropertyKey, never>;
export type useAllProjectsQuery$data = {
  readonly projects: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly gradientEndColor: string;
        readonly gradientStartColor: string;
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
};
export type useAllProjectsQuery = {
  response: useAllProjectsQuery$data;
  variables: useAllProjectsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Literal",
        "name": "first",
        "value": 1000
      }
    ],
    "concreteType": "ProjectConnection",
    "kind": "LinkedField",
    "name": "projects",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "ProjectEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Project",
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
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
                "name": "gradientStartColor",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "gradientEndColor",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": "projects(first:1000)"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useAllProjectsQuery",
    "selections": (v0/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "useAllProjectsQuery",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "06d79b836aa19dfc17479cc3b887f6fa",
    "id": null,
    "metadata": {},
    "name": "useAllProjectsQuery",
    "operationKind": "query",
    "text": "query useAllProjectsQuery {\n  projects(first: 1000) {\n    edges {\n      node {\n        id\n        name\n        gradientStartColor\n        gradientEndColor\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "b99a6e257a8e99aed698dee24a8f9658";

export default node;
