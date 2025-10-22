/**
 * @generated SignedSource<<7a8ada5ddeed4c2d1ff453c4900d8633>>
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
export type ExamplesSplitMenuAddDatasetExamplesToDatasetSplitsMutation$variables = {
  input: AddDatasetExamplesToDatasetSplitsInput;
};
export type ExamplesSplitMenuAddDatasetExamplesToDatasetSplitsMutation$data = {
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
export type ExamplesSplitMenuAddDatasetExamplesToDatasetSplitsMutation = {
  response: ExamplesSplitMenuAddDatasetExamplesToDatasetSplitsMutation$data;
  variables: ExamplesSplitMenuAddDatasetExamplesToDatasetSplitsMutation$variables;
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
    "name": "ExamplesSplitMenuAddDatasetExamplesToDatasetSplitsMutation",
    "selections": (v2/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ExamplesSplitMenuAddDatasetExamplesToDatasetSplitsMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "87cd4fcde008955481a75e0637a45bfe",
    "id": null,
    "metadata": {},
    "name": "ExamplesSplitMenuAddDatasetExamplesToDatasetSplitsMutation",
    "operationKind": "mutation",
    "text": "mutation ExamplesSplitMenuAddDatasetExamplesToDatasetSplitsMutation(\n  $input: AddDatasetExamplesToDatasetSplitsInput!\n) {\n  addDatasetExamplesToDatasetSplits(input: $input) {\n    examples {\n      id\n      datasetSplits {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "8aebd3a8a8e977a66b4fd4a11b831fbd";

export default node;
