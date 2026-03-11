/**
 * @generated SignedSource<<d93dd31c8492a7919fd6c6e4a3a995f3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ConfigInstanceListDeleteMutation$variables = {
  id: string;
};
export type ConfigInstanceListDeleteMutation$data = {
  readonly deleteSandboxConfig: {
    readonly id: string;
  };
};
export type ConfigInstanceListDeleteMutation = {
  response: ConfigInstanceListDeleteMutation$data;
  variables: ConfigInstanceListDeleteMutation$variables;
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
    "concreteType": "SandboxConfig",
    "kind": "LinkedField",
    "name": "deleteSandboxConfig",
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
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ConfigInstanceListDeleteMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ConfigInstanceListDeleteMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "883f7a2ad0b8aff3e3e6a446333afece",
    "id": null,
    "metadata": {},
    "name": "ConfigInstanceListDeleteMutation",
    "operationKind": "mutation",
    "text": "mutation ConfigInstanceListDeleteMutation(\n  $id: ID!\n) {\n  deleteSandboxConfig(id: $id) {\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "54688d22f514b20939988fea8cbe9db8";

export default node;
