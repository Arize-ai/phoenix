/**
 * @generated SignedSource<<1d9c1c9999de8153d647b57de4eab2b4>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CreatePromptLabelInput = {
  color: string;
  description?: string | null;
  name: string;
};
export type usePromptLabelMutationsCreateLabelMutation$variables = {
  connections: ReadonlyArray<string>;
  label: CreatePromptLabelInput;
};
export type usePromptLabelMutationsCreateLabelMutation$data = {
  readonly createPromptLabel: {
    readonly promptLabels: ReadonlyArray<{
      readonly color: string | null;
      readonly id: string;
      readonly name: string;
    }>;
  };
};
export type usePromptLabelMutationsCreateLabelMutation = {
  response: usePromptLabelMutationsCreateLabelMutation$data;
  variables: usePromptLabelMutationsCreateLabelMutation$variables;
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
  "name": "label"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "label"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "concreteType": "PromptLabel",
  "kind": "LinkedField",
  "name": "promptLabels",
  "plural": true,
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
      "name": "name",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "color",
      "storageKey": null
    }
  ],
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
    "name": "usePromptLabelMutationsCreateLabelMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "PromptLabelMutationPayload",
        "kind": "LinkedField",
        "name": "createPromptLabel",
        "plural": false,
        "selections": [
          (v3/*: any*/)
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
    "name": "usePromptLabelMutationsCreateLabelMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "PromptLabelMutationPayload",
        "kind": "LinkedField",
        "name": "createPromptLabel",
        "plural": false,
        "selections": [
          (v3/*: any*/),
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "prependNode",
            "key": "",
            "kind": "LinkedHandle",
            "name": "promptLabels",
            "handleArgs": [
              {
                "kind": "Variable",
                "name": "connections",
                "variableName": "connections"
              },
              {
                "kind": "Literal",
                "name": "edgeTypeName",
                "value": "PromptLabelEdge"
              }
            ]
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "8600130cb9db02bec9b9002a6338b796",
    "id": null,
    "metadata": {},
    "name": "usePromptLabelMutationsCreateLabelMutation",
    "operationKind": "mutation",
    "text": "mutation usePromptLabelMutationsCreateLabelMutation(\n  $label: CreatePromptLabelInput!\n) {\n  createPromptLabel(input: $label) {\n    promptLabels {\n      id\n      name\n      color\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "4a8dfd9b431701c95705b5098fdb8be2";

export default node;
