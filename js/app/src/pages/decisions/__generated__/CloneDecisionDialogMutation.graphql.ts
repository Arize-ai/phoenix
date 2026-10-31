/**
 * @generated SignedSource<<9a629e141652b4e5b836ca54b0c1759c>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CloneDecisionInput = {
  decisionId: string;
  description?: string | null;
  metadata?: any | null;
  name: string;
};
export type CloneDecisionDialogMutation$variables = {
  input: CloneDecisionInput;
};
export type CloneDecisionDialogMutation$data = {
  readonly cloneDecision: {
    readonly id: string;
  };
};
export type CloneDecisionDialogMutation = {
  response: CloneDecisionDialogMutation$data;
  variables: CloneDecisionDialogMutation$variables;
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
    "concreteType": "Decision",
    "kind": "LinkedField",
    "name": "cloneDecision",
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "CloneDecisionDialogMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "CloneDecisionDialogMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "618a2d159d0e199222f68aadf9d818ba",
    "id": null,
    "metadata": {},
    "name": "CloneDecisionDialogMutation",
    "operationKind": "mutation",
    "text": "mutation CloneDecisionDialogMutation(\n  $input: CloneDecisionInput!\n) {\n  cloneDecision(input: $input) {\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "b2f1c13856a457b1e284c31c5c8e1bfc";

export default node;
