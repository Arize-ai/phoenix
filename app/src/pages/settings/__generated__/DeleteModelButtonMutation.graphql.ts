/**
 * @generated SignedSource<<a6eecf4c2ab53a707a6e37b7d83b3c55>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeleteModelMutationInput = {
  id: string;
};
export type DeleteModelButtonMutation$variables = {
  connectionId: string;
  input: DeleteModelMutationInput;
};
export type DeleteModelButtonMutation$data = {
  readonly deleteModel: {
    readonly model: {
      readonly id: string;
    };
  };
};
export type DeleteModelButtonMutation = {
  response: DeleteModelButtonMutation$data;
  variables: DeleteModelButtonMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connectionId"
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
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "DeleteModelButtonMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "DeleteModelMutationPayload",
        "kind": "LinkedField",
        "name": "deleteModel",
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
              (v3/*: any*/)
            ],
            "storageKey": null
          }
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
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "DeleteModelButtonMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "DeleteModelMutationPayload",
        "kind": "LinkedField",
        "name": "deleteModel",
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
              (v3/*: any*/),
              {
                "alias": null,
                "args": null,
                "filters": null,
                "handle": "deleteEdge",
                "key": "",
                "kind": "ScalarHandle",
                "name": "id",
                "handleArgs": [
                  {
                    "items": [
                      {
                        "kind": "Variable",
                        "name": "connections.0",
                        "variableName": "connectionId"
                      }
                    ],
                    "kind": "ListValue",
                    "name": "connections"
                  }
                ]
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "cf26e174e2073217be6d1b1807ac7785",
    "id": null,
    "metadata": {},
    "name": "DeleteModelButtonMutation",
    "operationKind": "mutation",
    "text": "mutation DeleteModelButtonMutation(\n  $input: DeleteModelMutationInput!\n) {\n  deleteModel(input: $input) {\n    model {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "1ccbc631eb0ed2f999141b05c7f7bd8c";

export default node;
