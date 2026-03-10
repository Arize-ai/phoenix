/**
 * @generated SignedSource<<0a60afdec47815baff4c7cc3f02b4b86>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SettingsSandboxPageSetEnabledMutation$variables = {
  enabled: boolean;
};
export type SettingsSandboxPageSetEnabledMutation$data = {
  readonly setSandboxEnabled: boolean;
};
export type SettingsSandboxPageSetEnabledMutation = {
  response: SettingsSandboxPageSetEnabledMutation$data;
  variables: SettingsSandboxPageSetEnabledMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "enabled"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "enabled",
        "variableName": "enabled"
      }
    ],
    "kind": "ScalarField",
    "name": "setSandboxEnabled",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SettingsSandboxPageSetEnabledMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsSandboxPageSetEnabledMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "fb0819caff05ce4f93aafb5f9413c687",
    "id": null,
    "metadata": {},
    "name": "SettingsSandboxPageSetEnabledMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsSandboxPageSetEnabledMutation(\n  $enabled: Boolean!\n) {\n  setSandboxEnabled(enabled: $enabled)\n}\n"
  }
};
})();

(node as any).hash = "c2d0f12e71fddc3cbb5e3228ac573bd8";

export default node;
