/**
 * @generated SignedSource<<7ecba2c857280ba043a46f6150bc9e27>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeletePromptLabelsInput = {
  promptLabelIds: ReadonlyArray<string>;
};
export type DeletePromptLabelButtonMutation$variables = {
  connections: ReadonlyArray<string>;
  input: DeletePromptLabelsInput;
};
export type DeletePromptLabelButtonMutation$data = {
  readonly deletePromptLabels: {
    readonly deletedPromptLabelIds: ReadonlyArray<string>;
  };
};
export type DeletePromptLabelButtonMutation = {
  response: DeletePromptLabelButtonMutation$data;
  variables: DeletePromptLabelButtonMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connections"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "input"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "deletedPromptLabelIds",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "DeletePromptLabelButtonMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "PromptLabelDeleteMutationPayload",
        "kind": "LinkedField",
        "name": "deletePromptLabels",
        "plural": false,
        "selections": [
          (v3/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
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
    "name": "DeletePromptLabelButtonMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "PromptLabelDeleteMutationPayload",
        "kind": "LinkedField",
        "name": "deletePromptLabels",
        "plural": false,
        "selections": [
          (v3/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "deleteEdge",
            "key": "",
            "kind": "ScalarHandle",
            "name": "deletedPromptLabelIds",
            "handleArgs": [
              {
                "kind": "Variable",
                "name": "connections",
                "variableName": "connections"
              }
            ]
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "7aff7ce5ec0e34e1c9a2cd200e88194e",
    "id": null,
    "metadata": {},
    "name": "DeletePromptLabelButtonMutation",
    "operationKind": "mutation",
    "text": "mutation DeletePromptLabelButtonMutation(\n  $input: DeletePromptLabelsInput!\n) {\n  deletePromptLabels(input: $input) {\n    deletedPromptLabelIds\n  }\n}\n"
  }
};
})();

(node as any).hash = "d35d931a28299f492d2c9400cdb165e2";

export default node;
