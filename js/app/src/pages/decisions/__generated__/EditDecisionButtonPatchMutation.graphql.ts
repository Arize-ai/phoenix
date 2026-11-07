/**
 * @generated SignedSource<<ab2fb8f80fdb91a38f3896b98d02a20c>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EditDecisionButtonPatchMutation$variables = {
  description?: string | null;
  id: string;
  metadata: any;
};
export type EditDecisionButtonPatchMutation$data = {
  readonly patchDecision: {
    readonly description: string | null;
    readonly id: string;
    readonly metadata: any;
  };
};
export type EditDecisionButtonPatchMutation = {
  response: EditDecisionButtonPatchMutation$data;
  variables: EditDecisionButtonPatchMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "description"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "metadata"
},
v3 = [
  {
    "alias": null,
    "args": [
      {
        "fields": [
          {
            "kind": "Variable",
            "name": "decisionId",
            "variableName": "id"
          },
          {
            "kind": "Variable",
            "name": "description",
            "variableName": "description"
          },
          {
            "kind": "Variable",
            "name": "metadata",
            "variableName": "metadata"
          }
        ],
        "kind": "ObjectValue",
        "name": "input"
      }
    ],
    "concreteType": "Decision",
    "kind": "LinkedField",
    "name": "patchDecision",
    "plural": false,
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
        "name": "description",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "metadata",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "EditDecisionButtonPatchMutation",
    "selections": (v3/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*:: as any*/),
      (v0/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "EditDecisionButtonPatchMutation",
    "selections": (v3/*:: as any*/)
  },
  "params": {
    "cacheID": "8451991d6bfa7e763df6bf2383931b98",
    "id": null,
    "metadata": {},
    "name": "EditDecisionButtonPatchMutation",
    "operationKind": "mutation",
    "text": "mutation EditDecisionButtonPatchMutation(\n  $id: ID!\n  $description: String\n  $metadata: JSON!\n) {\n  patchDecision(input: {decisionId: $id, description: $description, metadata: $metadata}) {\n    id\n    description\n    metadata\n  }\n}\n"
  }
};
})();

(node as any).hash = "70cb9bcc6dc043509b7b72dd134ea024";

export default node;
