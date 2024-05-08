/**
 * @generated SignedSource<<5e1b45b0887e25ef7f04571a3348dc05>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
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
    "cacheID": "8b00ab3aaef4c5fb3de24f7295d38499",
    "id": null,
    "metadata": {},
    "name": "ProjectActionMenuDeleteMutation",
    "operationKind": "mutation",
    "text": "mutation ProjectActionMenuDeleteMutation(\n  $projectId: GlobalID!\n) {\n  deleteProject(id: $projectId) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "3bf82e90b3f2d3485b4efb954e30b2cf";

export default node;
