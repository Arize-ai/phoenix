/**
 * @generated SignedSource<<129919edc4684d4b3dc3e1b7ca3c8420>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SetDatasetExampleCalibrationLabelsInput = {
  datasetId: string;
  labels: ReadonlyArray<DatasetExampleCalibrationLabelInput>;
};
export type DatasetExampleCalibrationLabelInput = {
  annotationName: string;
  exampleId: string;
  expectedRevisionId: string;
  explanation?: string | null;
  label?: string | null;
  score?: number | null;
};
export type EvaluatorPlaygroundExpectedOutputsMutation$variables = {
  input: SetDatasetExampleCalibrationLabelsInput;
};
export type EvaluatorPlaygroundExpectedOutputsMutation$data = {
  readonly setDatasetExampleCalibrationLabels: {
    readonly examples: ReadonlyArray<{
      readonly id: string;
      readonly revision: {
        readonly calibrationLabels: ReadonlyArray<{
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
export type EvaluatorPlaygroundExpectedOutputsMutation = {
  response: EvaluatorPlaygroundExpectedOutputsMutation$data;
  variables: EvaluatorPlaygroundExpectedOutputsMutation$variables;
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
    "concreteType": "DatasetExampleCalibrationLabelsPayload",
    "kind": "LinkedField",
    "name": "setDatasetExampleCalibrationLabels",
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
                "concreteType": "DatasetExampleCalibrationLabel",
                "kind": "LinkedField",
                "name": "calibrationLabels",
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
                    "name": "score",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "explanation",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "label",
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
    "name": "EvaluatorPlaygroundExpectedOutputsMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "EvaluatorPlaygroundExpectedOutputsMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "216e7623d759bbb38facfce8c9bc63dd",
    "id": null,
    "metadata": {},
    "name": "EvaluatorPlaygroundExpectedOutputsMutation",
    "operationKind": "mutation",
    "text": "mutation EvaluatorPlaygroundExpectedOutputsMutation(\n  $input: SetDatasetExampleCalibrationLabelsInput!\n) {\n  setDatasetExampleCalibrationLabels(input: $input) {\n    examples {\n      id\n      revision {\n        revisionId\n        calibrationLabels {\n          annotationName\n          score\n          explanation\n          label\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "8504bd23da5ab00a8738207f6df019e9";

export default node;
