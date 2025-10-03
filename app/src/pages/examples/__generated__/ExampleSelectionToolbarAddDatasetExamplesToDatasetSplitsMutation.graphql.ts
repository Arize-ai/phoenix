/**
 * @generated SignedSource<<2f4adecfdc38685bab2887f41767c39f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AddDatasetExamplesToDatasetSplitsInput = {
  datasetSplitIds: ReadonlyArray<string>;
  exampleIds: ReadonlyArray<string>;
};
export type ExampleSelectionToolbarAddDatasetExamplesToDatasetSplitsMutation$variables = {
  input: AddDatasetExamplesToDatasetSplitsInput;
};
export type ExampleSelectionToolbarAddDatasetExamplesToDatasetSplitsMutation$data = {
  readonly addDatasetExamplesToDatasetSplits: {
    readonly examples: ReadonlyArray<{
      readonly datasetSplits: ReadonlyArray<{
        readonly color: string;
        readonly id: string;
        readonly name: string;
      }>;
      readonly id: string;
    }>;
  };
};
export type ExampleSelectionToolbarAddDatasetExamplesToDatasetSplitsMutation = {
  response: ExampleSelectionToolbarAddDatasetExamplesToDatasetSplitsMutation$data;
  variables: ExampleSelectionToolbarAddDatasetExamplesToDatasetSplitsMutation$variables;
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
    "concreteType": "AddDatasetExamplesToDatasetSplitsMutationPayload",
    "kind": "LinkedField",
    "name": "addDatasetExamplesToDatasetSplits",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DatasetExample",
        "kind": "LinkedField",
        "name": "examples",
        "plural": true,
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
    "name": "ExampleSelectionToolbarAddDatasetExamplesToDatasetSplitsMutation",
    "selections": (v2/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ExampleSelectionToolbarAddDatasetExamplesToDatasetSplitsMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "06b9f49cd0904e598f87797547513590",
    "id": null,
    "metadata": {},
    "name": "ExampleSelectionToolbarAddDatasetExamplesToDatasetSplitsMutation",
    "operationKind": "mutation",
    "text": "mutation ExampleSelectionToolbarAddDatasetExamplesToDatasetSplitsMutation(\n  $input: AddDatasetExamplesToDatasetSplitsInput!\n) {\n  addDatasetExamplesToDatasetSplits(input: $input) {\n    examples {\n      id\n      datasetSplits {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "df6fafc7bc7158da6290c64761474286";

export default node;
