/**
 * @generated SignedSource<<28505b3ed3ba65dcf15dcc70983bca3e>>
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
  readonly exportEvents: {
    readonly directory: string;
    readonly fileName: string;
  };
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
    "concreteType": "ExportedFile",
    "kind": "LinkedField",
    "name": "exportEvents",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "directory",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "fileName",
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
    "cacheID": "5da94d6d7ccf522e31264ae10908ce46",
    "id": null,
    "metadata": {},
    "name": "ExportSelectionButtonMutation",
    "operationKind": "mutation",
    "text": "mutation ExportSelectionButtonMutation(\n  $eventIds: [ID!]!\n) {\n  exportEvents(eventIds: $eventIds) {\n    directory\n    fileName\n  }\n}\n"
  }
};
})();

(node as any).hash = "d79bee03d9b17c1e6e276ef7b124de81";

export default node;
