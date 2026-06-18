/**
 * @generated SignedSource<<aae8d4fa21570fa185c2e3b1c01047f9>>
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
      readonly usageCount: number;
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
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "usageCount",
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
    "cacheID": "056f27e5e547ee415dcc74ff4e48c487",
    "id": null,
    "metadata": {},
    "name": "usePromptLabelMutationsCreateLabelMutation",
    "operationKind": "mutation",
    "text": "mutation usePromptLabelMutationsCreateLabelMutation(\n  $label: CreatePromptLabelInput!\n) {\n  createPromptLabel(input: $label) {\n    promptLabels {\n      id\n      name\n      color\n      usageCount\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "6de334eb8b54795e0e70fb3e432b04e4";

export default node;
