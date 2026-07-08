/**
 * @generated SignedSource<<f978e202e5e41f3d96429f2630881a35>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ObjectPermission = "EDIT" | "MANAGE_ACCESS" | "VIEW";
export type SettingsRolesPageQuery$variables = Record<PropertyKey, never>;
export type SettingsRolesPageQuery$data = {
  readonly permissionSets: ReadonlyArray<{
    readonly id: string;
    readonly isBuiltIn: boolean;
    readonly name: string;
    readonly permissions: ReadonlyArray<ObjectPermission>;
  }>;
};
export type SettingsRolesPageQuery = {
  response: SettingsRolesPageQuery$data;
  variables: SettingsRolesPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "PermissionSet",
    "kind": "LinkedField",
    "name": "permissionSets",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "name",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "isBuiltIn",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "permissions",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "SettingsRolesPageQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "SettingsRolesPageQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "102f215deca5edff040d9f9076588e3a",
    "id": null,
    "metadata": {},
    "name": "SettingsRolesPageQuery",
    "operationKind": "query",
    "text": "query SettingsRolesPageQuery {\n  permissionSets {\n    id\n    name\n    isBuiltIn\n    permissions\n  }\n}\n"
  }
};
})();

(node as any).hash = "e045e901fc22065e8f75a31534a5df97";

export default node;
