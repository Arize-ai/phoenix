/**
 * @generated SignedSource<<8037ee9fc802bfbdba24e1060843b038>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DecisionActionsPatchMutation$variables = {
  description?: string | null;
  id: string;
};
export type DecisionActionsPatchMutation$data = {
  readonly patchDecision: {
    readonly description: string | null;
    readonly id: string;
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
v2 = [
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
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "DecisionActionsPatchMutation",
    "selections": (v2/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "DecisionActionsPatchMutation",
    "selections": (v2/*:: as any*/)
  },
  "params": {
    "cacheID": "5c9cf178cd924dfe0e1d6bdd37679fcd",
    "id": null,
    "metadata": {},
    "name": "DecisionActionsPatchMutation",
    "operationKind": "mutation",
    "text": "mutation DecisionActionsPatchMutation(\n  $id: ID!\n  $description: String\n) {\n  patchDecision(input: {decisionId: $id, description: $description}) {\n    id\n    description\n  }\n}\n"
  }
};
})();

(node as any).hash = "e87bfc48382597f280e409837b9e0c64";

export default node;
