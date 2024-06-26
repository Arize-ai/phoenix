/**
 * @generated SignedSource<<be170109dc822225ec36dfd10a510d14>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
export type ClearProjectInput = {
  endTime?: string | null;
  id: string;
};
export type RemoveProjectTracesFormMutation$variables = {
  input: ClearProjectInput;
};
export type RemoveProjectTracesFormMutation$data = {
  readonly clearProject: {
    readonly __typename: "Query";
  };
};
export type RemoveProjectTracesFormMutation = {
  response: RemoveProjectTracesFormMutation$data;
  variables: RemoveProjectTracesFormMutation$variables;
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
    "name": "RemoveProjectTracesFormMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "RemoveProjectTracesFormMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "13f14af324183cf751b6189b6c881350",
    "id": null,
    "metadata": {},
    "name": "RemoveProjectTracesFormMutation",
    "operationKind": "mutation",
    "text": "mutation RemoveProjectTracesFormMutation(\n  $input: ClearProjectInput!\n) {\n  clearProject(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "c6e128868d911c21c74ce7075ec73e13";

export default node;
