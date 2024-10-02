/**
 * @generated SignedSource<<8c3bf96d39446a9242e6f051aa1cc5d2>>
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
export type RemoveProjectDataFormMutation$variables = {
  input: ClearProjectInput;
};
export type RemoveProjectDataFormMutation$data = {
  readonly clearProject: {
    readonly __typename: "Query";
  };
};
export type RemoveProjectDataFormMutation = {
  response: RemoveProjectDataFormMutation$data;
  variables: RemoveProjectDataFormMutation$variables;
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
    "name": "RemoveProjectDataFormMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "RemoveProjectDataFormMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "1b27a3f7535c3f3943b0f2248d1505a6",
    "id": null,
    "metadata": {},
    "name": "RemoveProjectDataFormMutation",
    "operationKind": "mutation",
    "text": "mutation RemoveProjectDataFormMutation(\n  $input: ClearProjectInput!\n) {\n  clearProject(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "212501fe2d6367ec1503bd7a00c1730f";

export default node;
