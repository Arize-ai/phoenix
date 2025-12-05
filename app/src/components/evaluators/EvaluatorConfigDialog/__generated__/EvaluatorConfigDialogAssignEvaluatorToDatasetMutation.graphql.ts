/**
 * @generated SignedSource<<0e7c926ef7fa10ea0192997d438808a0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type AssignEvaluatorToDatasetInput = {
  datasetId: string;
  displayName?: string | null;
  evaluatorId: string;
  inputMapping?: EvaluatorInputMappingInput | null;
};
export type EvaluatorInputMappingInput = {
  literalMapping?: any;
  pathMapping?: any;
};
export type EvaluatorConfigDialogAssignEvaluatorToDatasetMutation$variables = {
  connectionIds: ReadonlyArray<string>;
  input: AssignEvaluatorToDatasetInput;
};
export type EvaluatorConfigDialogAssignEvaluatorToDatasetMutation$data = {
  readonly assignEvaluatorToDataset: {
    readonly evaluator: {
      readonly " $fragmentSpreads": FragmentRefs<"EvaluatorsTable_row">;
    };
  };
};
export type EvaluatorConfigDialogAssignEvaluatorToDatasetMutation = {
  response: EvaluatorConfigDialogAssignEvaluatorToDatasetMutation$data;
  variables: EvaluatorConfigDialogAssignEvaluatorToDatasetMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connectionIds"
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
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v9 = [
  (v3/*: any*/),
  (v4/*: any*/)
],
v10 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "Prompt",
      "kind": "LinkedField",
      "name": "prompt",
      "plural": false,
      "selections": (v9/*: any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "pinnedPromptVersionId",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "PromptVersionTag",
      "kind": "LinkedField",
      "name": "promptVersionTag",
      "plural": false,
      "selections": (v9/*: any*/),
      "storageKey": null
    }
  ],
  "type": "LLMEvaluator",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "EvaluatorConfigDialogAssignEvaluatorToDatasetMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "EvaluatorMutationPayload",
        "kind": "LinkedField",
        "name": "assignEvaluatorToDataset",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": null,
            "kind": "LinkedField",
            "name": "evaluator",
            "plural": false,
            "selections": [
              {
                "kind": "InlineDataFragmentSpread",
                "name": "EvaluatorsTable_row",
                "selections": [
                  (v3/*: any*/),
                  (v4/*: any*/),
                  (v5/*: any*/),
                  (v6/*: any*/),
                  (v7/*: any*/),
                  (v8/*: any*/),
                  (v10/*: any*/)
                ],
                "args": null,
                "argumentDefinitions": []
              }
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
    "name": "EvaluatorConfigDialogAssignEvaluatorToDatasetMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "EvaluatorMutationPayload",
        "kind": "LinkedField",
        "name": "assignEvaluatorToDataset",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": null,
            "kind": "LinkedField",
            "name": "evaluator",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "__typename",
                "storageKey": null
              },
              {
                "kind": "TypeDiscriminator",
                "abstractKey": "__isEvaluator"
              },
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v10/*: any*/)
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "appendNode",
            "key": "",
            "kind": "LinkedHandle",
            "name": "evaluator",
            "handleArgs": [
              {
                "kind": "Variable",
                "name": "connections",
                "variableName": "connectionIds"
              },
              {
                "kind": "Literal",
                "name": "edgeTypeName",
                "value": "EvaluatorEdge"
              }
            ]
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "624277052316732c07edb5ba97db138b",
    "id": null,
    "metadata": {},
    "name": "EvaluatorConfigDialogAssignEvaluatorToDatasetMutation",
    "operationKind": "mutation",
    "text": "mutation EvaluatorConfigDialogAssignEvaluatorToDatasetMutation(\n  $input: AssignEvaluatorToDatasetInput!\n) {\n  assignEvaluatorToDataset(input: $input) {\n    evaluator {\n      __typename\n      ...EvaluatorsTable_row\n      id\n    }\n  }\n}\n\nfragment EvaluatorsTable_row on Evaluator {\n  __isEvaluator: __typename\n  id\n  name\n  kind\n  description\n  createdAt\n  updatedAt\n  ... on LLMEvaluator {\n    prompt {\n      id\n      name\n    }\n    pinnedPromptVersionId\n    promptVersionTag {\n      id\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "6592e813784d416458b3b3d1826e294f";

export default node;
