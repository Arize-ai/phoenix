/**
 * @generated SignedSource<<e17bc0b89c69e354310a9df13a32ca73>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ProjectMenuSelectedProjectQuery$variables = {
  id: string;
};
export type ProjectMenuSelectedProjectQuery$data = {
  readonly node: {
    readonly __typename: string;
    readonly id: string;
    readonly name?: string;
  };
};
export type ProjectMenuSelectedProjectQuery = {
  response: ProjectMenuSelectedProjectQuery$data;
  variables: ProjectMenuSelectedProjectQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "id",
        "variableName": "id"
      }
    ],
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
        "kind": "InlineFragment",
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "name",
            "storageKey": null
          }
        ],
        "type": "Project",
        "abstractKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectMenuSelectedProjectQuery",
    "selections": (v1/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ProjectMenuSelectedProjectQuery",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "825b96fe121d54901eedb6421105d7fd",
    "id": null,
    "metadata": {},
    "name": "ProjectMenuSelectedProjectQuery",
    "operationKind": "query",
    "text": "query ProjectMenuSelectedProjectQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    id\n    ... on Project {\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "85a4afeedcc7da8dada83bfb4b293453";

export default node;
