/**
 * @generated SignedSource<<705771245f49d4032a75ea7744366f62>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SettingsSandboxPageDeleteMutation$variables = {
  id: string;
};
export type SettingsSandboxPageDeleteMutation$data = {
  readonly deleteSandboxConfig: {
    readonly id: string;
  };
};
export type SettingsSandboxPageDeleteMutation = {
  response: SettingsSandboxPageDeleteMutation$data;
  variables: SettingsSandboxPageDeleteMutation$variables;
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
    "name": "SettingsSandboxPageDeleteMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsSandboxPageDeleteMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "1e60bf935fcdbc096fa9697c32ca3678",
    "id": null,
    "metadata": {},
    "name": "SettingsSandboxPageDeleteMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsSandboxPageDeleteMutation(\n  $id: ID!\n) {\n  deleteSandboxConfig(id: $id) {\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "1082fd0a3ea170ba847509244a5d3d7e";

export default node;
