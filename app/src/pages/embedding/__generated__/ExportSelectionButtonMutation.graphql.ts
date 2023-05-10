/**
 * @generated SignedSource<<c8eb841a7d431a2662165f2f5e7cd929>>
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
    "cacheID": "d370df04ca30a5059288c7aa298239a8",
    "id": null,
    "metadata": {},
    "name": "ExportSelectionButtonMutation",
    "operationKind": "mutation",
    "text": "mutation ExportSelectionButtonMutation(\n  $eventIds: [ID!]!\n) {\n  exportEvents(eventIds: $eventIds) {\n    fileName\n  }\n}\n"
  }
};
})();

(node as any).hash = "8b0d6962e2034d4c148d1b9919111d2f";

export default node;
