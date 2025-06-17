/**
 * @generated SignedSource<<24b2b25f59e938e099c2ad0522c06bee>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CreateModelMutationInput = {
  costs: ReadonlyArray<CostPerTokenInput>;
  name: string;
  namePattern: string;
  provider?: string | null;
};
export type CostPerTokenInput = {
  costPerToken: number;
  tokenType: string;
};
export type NewModelButtonCreateModelMutation$variables = {
  input: CreateModelMutationInput;
};
export type NewModelButtonCreateModelMutation$data = {
  readonly createModel: {
    readonly model: {
      readonly id: string;
    };
  };
};
export type NewModelButtonCreateModelMutation = {
  response: NewModelButtonCreateModelMutation$data;
  variables: NewModelButtonCreateModelMutation$variables;
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
    "concreteType": "CreateModelMutationPayload",
    "kind": "LinkedField",
    "name": "createModel",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "GenerativeModel",
        "kind": "LinkedField",
        "name": "model",
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
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "NewModelButtonCreateModelMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "NewModelButtonCreateModelMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "cfeb8f6f005efc0bf6a9e320a17dc563",
    "id": null,
    "metadata": {},
    "name": "NewModelButtonCreateModelMutation",
    "operationKind": "mutation",
    "text": "mutation NewModelButtonCreateModelMutation(\n  $input: CreateModelMutationInput!\n) {\n  createModel(input: $input) {\n    model {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "81e9d106260ec96c59ebe20a45b25a88";

export default node;
