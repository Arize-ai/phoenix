/**
 * @generated SignedSource<<50aecbf495225f130cec13040a1b998e>>
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
export type EvaluatorPlaygroundReviewMutation$variables = {
  input: SetDatasetExampleCalibrationLabelsInput;
};
export type EvaluatorPlaygroundReviewMutation$data = {
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
export type EvaluatorPlaygroundReviewMutation = {
  response: EvaluatorPlaygroundReviewMutation$data;
  variables: EvaluatorPlaygroundReviewMutation$variables;
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
    "name": "EvaluatorPlaygroundReviewMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "EvaluatorPlaygroundReviewMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "6e2c91fc484a1f787ad640d2394b9380",
    "id": null,
    "metadata": {},
    "name": "EvaluatorPlaygroundReviewMutation",
    "operationKind": "mutation",
    "text": "mutation EvaluatorPlaygroundReviewMutation(\n  $input: SetDatasetExampleCalibrationLabelsInput!\n) {\n  setDatasetExampleCalibrationLabels(input: $input) {\n    examples {\n      id\n      revision {\n        revisionId\n        calibrationLabels {\n          annotationName\n          score\n          explanation\n          label\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "1c6752810ffa5dbf363d6cfde76a30ec";

export default node;
