/**
 * @generated SignedSource<<068ba089800aaac7763812a17f008d16>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ClearProjectInput = {
  endTime?: string | null;
  id: string;
};
export type ProjectActionMenuClearMutation$variables = {
  input: ClearProjectInput;
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
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
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
    "cacheID": "63319b4e42b499db2447817f1dc821fb",
    "id": null,
    "metadata": {},
    "name": "ProjectActionMenuClearMutation",
    "operationKind": "mutation",
    "text": "mutation ProjectActionMenuClearMutation(\n  $input: ClearProjectInput!\n) {\n  clearProject(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "c43eec4d6b882468c611dd9ebf3b095e";

export default node;
