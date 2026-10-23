/**
 * @generated SignedSource<<12ad03cb163a2133bffa1e65538ee3ec>>
 * @lightSyntaxTransform
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
      readonly description: string | null;
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
      "name": "description",
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
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "usePromptLabelMutationsCreateLabelMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "PromptLabelMutationPayload",
        "kind": "LinkedField",
        "name": "createPromptLabel",
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
    "name": "usePromptLabelMutationsCreateLabelMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "PromptLabelMutationPayload",
        "kind": "LinkedField",
        "name": "createPromptLabel",
        "plural": false,
        "selections": [
          (v3/*:: as any*/),
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
    "cacheID": "5811d57037306e2cb11f81de0fb44d2d",
    "id": null,
    "metadata": {},
    "name": "usePromptLabelMutationsCreateLabelMutation",
    "operationKind": "mutation",
    "text": "mutation usePromptLabelMutationsCreateLabelMutation(\n  $label: CreatePromptLabelInput!\n) {\n  createPromptLabel(input: $label) {\n    promptLabels {\n      id\n      name\n      description\n      color\n      usageCount\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "27f1008c042a805db5d4a0873e49c4b5";

export default node;
