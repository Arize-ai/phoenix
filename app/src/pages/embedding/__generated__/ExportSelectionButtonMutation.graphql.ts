/**
 * @generated SignedSource<<ea27a083a16724de8371619d6e6480bf>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
export type ExportSelectionButtonMutation$variables = {
  eventIds: ReadonlyArray<string>;
};
export type ExportSelectionButtonMutation$data = {
  readonly exportEvents: string;
};
export type ExportSelectionButtonMutation = {
  response: ExportSelectionButtonMutation$data;
  variables: ExportSelectionButtonMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "eventIds"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "eventIds",
        "variableName": "eventIds"
      }
    ],
    "kind": "ScalarField",
    "name": "exportEvents",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ExportSelectionButtonMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ExportSelectionButtonMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "934b5b4b6cd0983c23f163f0b68bf800",
    "id": null,
    "metadata": {},
    "name": "ExportSelectionButtonMutation",
    "operationKind": "mutation",
    "text": "mutation ExportSelectionButtonMutation(\n  $eventIds: [ID!]!\n) {\n  exportEvents(eventIds: $eventIds)\n}\n"
  }
};
})();

(node as any).hash = "3f573f66d66a4d497152248cf82773a5";

export default node;
