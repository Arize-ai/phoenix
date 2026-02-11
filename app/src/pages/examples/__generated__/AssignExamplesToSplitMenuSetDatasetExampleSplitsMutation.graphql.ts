/**
 * @generated SignedSource<<26a3c02db8c9cf2eb925c98509d7eb7c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SetDatasetExampleSplitsInput = {
  datasetSplitIds: ReadonlyArray<string>;
  exampleId: string;
};
export type AssignExamplesToSplitMenuSetDatasetExampleSplitsMutation$variables = {
  input: SetDatasetExampleSplitsInput;
};
export type AssignExamplesToSplitMenuSetDatasetExampleSplitsMutation$data = {
  readonly setDatasetExampleSplits: {
    readonly example: {
      readonly datasetSplits: ReadonlyArray<{
        readonly color: string;
        readonly id: string;
        readonly name: string;
      }>;
      readonly id: string;
    };
  };
};
export type AssignExamplesToSplitMenuSetDatasetExampleSplitsMutation = {
  response: AssignExamplesToSplitMenuSetDatasetExampleSplitsMutation$data;
  variables: AssignExamplesToSplitMenuSetDatasetExampleSplitsMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "SetDatasetExampleSplitsMutationPayload",
    "kind": "LinkedField",
    "name": "setDatasetExampleSplits",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DatasetExample",
        "kind": "LinkedField",
        "name": "example",
        "plural": false,
        "selections": [
          (v1/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "DatasetSplit",
            "kind": "LinkedField",
            "name": "datasetSplits",
            "plural": true,
            "selections": [
              (v1/*: any*/),
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
    "name": "AssignExamplesToSplitMenuSetDatasetExampleSplitsMutation",
    "selections": (v2/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "AssignExamplesToSplitMenuSetDatasetExampleSplitsMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "5a70eb04d75cb977a01f115bb8cfd85a",
    "id": null,
    "metadata": {},
    "name": "AssignExamplesToSplitMenuSetDatasetExampleSplitsMutation",
    "operationKind": "mutation",
    "text": "mutation AssignExamplesToSplitMenuSetDatasetExampleSplitsMutation(\n  $input: SetDatasetExampleSplitsInput!\n) {\n  setDatasetExampleSplits(input: $input) {\n    example {\n      id\n      datasetSplits {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "8b8ee0b811780f0d1a497d915f6a3537";

export default node;
