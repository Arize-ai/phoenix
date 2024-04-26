/**
 * @generated SignedSource<<403c587087714464973de2bbe42708ea>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
export type ProjectActionMenuClearMutation$variables = {
  projectId: string;
};
export type ProjectActionMenuClearMutation$data = {
  readonly clearProject: {
    readonly __typename: "Query";
  };
};
export type ProjectActionMenuClearMutation = {
  response: ProjectActionMenuClearMutation$data;
  variables: ProjectActionMenuClearMutation$variables;
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
    "name": "clearProject",
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
    "name": "ProjectActionMenuClearMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ProjectActionMenuClearMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "df98f55f45a3f0fd18cce292075de372",
    "id": null,
    "metadata": {},
    "name": "ProjectActionMenuClearMutation",
    "operationKind": "mutation",
    "text": "mutation ProjectActionMenuClearMutation(\n  $projectId: GlobalID!\n) {\n  clearProject(id: $projectId) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "797829dd3e5805e9484727123e51b5c3";

export default node;
