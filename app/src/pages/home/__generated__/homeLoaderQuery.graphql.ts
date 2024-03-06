/**
 * @generated SignedSource<<da8e05e3cfba3521983985fc289eeb47>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type homeLoaderQuery$variables = {};
export type homeLoaderQuery$data = {
  readonly functionality: {
    readonly modelInferences: boolean;
  };
  readonly projects: {
    readonly edges: ReadonlyArray<{
      readonly project: {
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
    "cacheID": "1e5891dd28a695ec1fc504659d641b37",
    "id": null,
    "metadata": {},
    "name": "homeLoaderQuery",
    "operationKind": "query",
    "text": "query homeLoaderQuery {\n  functionality {\n    modelInferences\n  }\n  projects {\n    edges {\n      project: node {\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e2022661bc6153e1c8cc2c94257a2d47";

export default node;
