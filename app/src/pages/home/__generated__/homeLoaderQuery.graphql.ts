/**
 * @generated SignedSource<<fd029bdb4d270e271279fce055881bec>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type homeLoaderQuery$variables = Record<PropertyKey, never>;
export type homeLoaderQuery$data = {
  readonly functionality: {
    readonly modelInferences: boolean;
  };
  readonly projects: {
    readonly edges: ReadonlyArray<{
      readonly project: {
        readonly endTime: string | null;
        readonly id: string;
      };
    }>;
  };
};
export type homeLoaderQuery = {
  response: homeLoaderQuery$data;
  variables: homeLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "Functionality",
    "kind": "LinkedField",
    "name": "functionality",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "modelInferences",
        "storageKey": null
      }
    ],
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
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
            "alias": "project",
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
                "name": "endTime",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "homeLoaderQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "homeLoaderQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "6926e4e720b443f7b7252b60271944e6",
    "id": null,
    "metadata": {},
    "name": "homeLoaderQuery",
    "operationKind": "query",
    "text": "query homeLoaderQuery {\n  functionality {\n    modelInferences\n  }\n  projects {\n    edges {\n      project: node {\n        id\n        endTime\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "a4bbc4917b3217b8254d68ec7c76dbdd";

export default node;
