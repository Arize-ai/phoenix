/**
 * @generated SignedSource<<4da128c6f172f0e35dd5f420ec3f11a6>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SetDatasetExampleExpectedOutputsInput = {
  datasetId: string;
  expectedOutputs: ReadonlyArray<DatasetExampleExpectedOutputInput>;
};
export type DatasetExampleExpectedOutputInput = {
  annotationName: string;
  exampleId: string;
  expectedRevisionId: string;
  explanation?: string | null;
  label?: string | null;
  score?: number | null;
};
export type PlaygroundExpectedOutputsContextMutation$variables = {
  input: SetDatasetExampleExpectedOutputsInput;
};
export type PlaygroundExpectedOutputsContextMutation$data = {
  readonly setDatasetExampleExpectedOutputs: {
    readonly examples: ReadonlyArray<{
      readonly id: string;
      readonly revision: {
        readonly expectedOutputs: ReadonlyArray<{
          readonly annotationName: string;
          readonly explanation: string | null;
          readonly label: string | null;
          readonly score: number | null;
        }>;
        readonly revisionId: string;
      };
    }>;
  };
};
export type PlaygroundExpectedOutputsContextMutation = {
  response: PlaygroundExpectedOutputsContextMutation$data;
  variables: PlaygroundExpectedOutputsContextMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "DatasetExampleExpectedOutputsPayload",
    "kind": "LinkedField",
    "name": "setDatasetExampleExpectedOutputs",
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
            "concreteType": "DatasetExampleRevision",
            "kind": "LinkedField",
            "name": "revision",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "revisionId",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "DatasetExampleExpectedOutput",
                "kind": "LinkedField",
                "name": "expectedOutputs",
                "plural": true,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "annotationName",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "label",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "score",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "explanation",
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
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PlaygroundExpectedOutputsContextMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "PlaygroundExpectedOutputsContextMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "22356d6ca64989e31853c74be7e27f9e",
    "id": null,
    "metadata": {},
    "name": "PlaygroundExpectedOutputsContextMutation",
    "operationKind": "mutation",
    "text": "mutation PlaygroundExpectedOutputsContextMutation(\n  $input: SetDatasetExampleExpectedOutputsInput!\n) {\n  setDatasetExampleExpectedOutputs(input: $input) {\n    examples {\n      id\n      revision {\n        revisionId\n        expectedOutputs {\n          annotationName\n          label\n          score\n          explanation\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "33f9b73377b224de9bbffc8d0fa30b11";

export default node;
