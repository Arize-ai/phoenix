/**
 * @generated SignedSource<<445f901b27ecec12ef746cdac4c4ad2a>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DecisionActionsPatchMutation$variables = {
  description?: string | null;
  id: string;
  metadata: any;
};
export type DecisionActionsPatchMutation$data = {
  readonly patchDecision: {
    readonly description: string | null;
    readonly id: string;
    readonly metadata: any;
  };
};
export type DecisionActionsPatchMutation = {
  response: DecisionActionsPatchMutation$data;
  variables: DecisionActionsPatchMutation$variables;
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
    "name": "DecisionActionsPatchMutation",
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
    "name": "DecisionActionsPatchMutation",
    "selections": (v3/*:: as any*/)
  },
  "params": {
    "cacheID": "314e98dfc0c05fc716bac1e70ef717f8",
    "id": null,
    "metadata": {},
    "name": "DecisionActionsPatchMutation",
    "operationKind": "mutation",
    "text": "mutation DecisionActionsPatchMutation(\n  $id: ID!\n  $description: String\n  $metadata: JSON!\n) {\n  patchDecision(input: {decisionId: $id, description: $description, metadata: $metadata}) {\n    id\n    description\n    metadata\n  }\n}\n"
  }
};
})();

(node as any).hash = "0ed85cec6f8e933994dec3a2bcaad5cf";

export default node;
