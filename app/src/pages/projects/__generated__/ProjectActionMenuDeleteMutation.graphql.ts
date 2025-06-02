/**
 * @generated SignedSource<<9654dd814cbf9984a4fc91458ff428b5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ProjectActionMenuDeleteMutation$variables = {
  projectId: string;
};
export type ProjectActionMenuDeleteMutation$data = {
  readonly deleteProject: {
    readonly __typename: "Query";
  };
};
export type ProjectActionMenuDeleteMutation = {
  response: ProjectActionMenuDeleteMutation$data;
  variables: ProjectActionMenuDeleteMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "projectId"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "id",
        "variableName": "projectId"
      }
    ],
    "concreteType": "Query",
    "kind": "LinkedField",
    "name": "deleteProject",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "__typename",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectActionMenuDeleteMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ProjectActionMenuDeleteMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "9a79d6d39a73196765b89d130a8e6a3f",
    "id": null,
    "metadata": {},
    "name": "ProjectActionMenuDeleteMutation",
    "operationKind": "mutation",
    "text": "mutation ProjectActionMenuDeleteMutation(\n  $projectId: ID!\n) {\n  deleteProject(id: $projectId) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "e97af5c157e96020ec94d1ca72af6737";

export default node;
