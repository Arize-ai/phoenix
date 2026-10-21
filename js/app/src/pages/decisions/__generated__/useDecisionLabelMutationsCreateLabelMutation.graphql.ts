/**
 * @generated SignedSource<<45aac80445c0380e6f50ddfb85bb6e06>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CreateDecisionLabelInput = {
  color: string;
  description?: string | null;
  name: string;
};
export type useDecisionLabelMutationsCreateLabelMutation$variables = {
  connections: ReadonlyArray<string>;
  label: CreateDecisionLabelInput;
};
export type useDecisionLabelMutationsCreateLabelMutation$data = {
  readonly createDecisionLabel: {
    readonly decisionLabels: ReadonlyArray<{
      readonly color: string | null;
      readonly id: string;
      readonly name: string;
      readonly usageCount: number;
    }>;
  };
};
export type useDecisionLabelMutationsCreateLabelMutation = {
  response: useDecisionLabelMutationsCreateLabelMutation$data;
  variables: useDecisionLabelMutationsCreateLabelMutation$variables;
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
  "concreteType": "DecisionLabel",
  "kind": "LinkedField",
  "name": "decisionLabels",
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
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "useDecisionLabelMutationsCreateLabelMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "DecisionLabelMutationPayload",
        "kind": "LinkedField",
        "name": "createDecisionLabel",
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
    "name": "useDecisionLabelMutationsCreateLabelMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "DecisionLabelMutationPayload",
        "kind": "LinkedField",
        "name": "createDecisionLabel",
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
            "name": "decisionLabels",
            "handleArgs": [
              {
                "kind": "Variable",
                "name": "connections",
                "variableName": "connections"
              },
              {
                "kind": "Literal",
                "name": "edgeTypeName",
                "value": "DecisionLabelEdge"
              }
            ]
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "9929491485b7fb4bec6244e548396f27",
    "id": null,
    "metadata": {},
    "name": "useDecisionLabelMutationsCreateLabelMutation",
    "operationKind": "mutation",
    "text": "mutation useDecisionLabelMutationsCreateLabelMutation(\n  $label: CreateDecisionLabelInput!\n) {\n  createDecisionLabel(input: $label) {\n    decisionLabels {\n      id\n      name\n      color\n      usageCount\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "cd635d2c108741111dd129cbdf1c54ed";

export default node;
