/**
 * @generated SignedSource<<6672904288ff278703554f24f4a4b611>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
export type ProjectActionMenuMutation$variables = {
  projectId: string;
};
export type ProjectActionMenuMutation$data = {
  readonly deleteProject: {
    readonly __typename: "Query";
  };
};
export type ProjectActionMenuMutation = {
  response: ProjectActionMenuMutation$data;
  variables: ProjectActionMenuMutation$variables;
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
    "name": "ProjectActionMenuMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ProjectActionMenuMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "9b9e922bf9a468e4b6166e10cd1110ab",
    "id": null,
    "metadata": {},
    "name": "ProjectActionMenuMutation",
    "operationKind": "mutation",
    "text": "mutation ProjectActionMenuMutation(\n  $projectId: GlobalID!\n) {\n  deleteProject(id: $projectId) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "170d4680c5e7c589eedced2ddabe68a8";

export default node;
