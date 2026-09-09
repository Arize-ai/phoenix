/**
 * @generated SignedSource<<2d0b6f4bd58467a0135a20ef6d4698a6>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SetDatasetExampleCalibrationLabelInput = {
  annotationName: string;
  datasetId: string;
  exampleId: string;
  expectedRevisionId: string;
  explanation?: string | null;
  label?: string | null;
  score?: number | null;
};
export type EvaluatorPlaygroundReviewMutation$variables = {
  input: SetDatasetExampleCalibrationLabelInput;
};
export type EvaluatorPlaygroundReviewMutation$data = {
  readonly setDatasetExampleCalibrationLabel: {
    readonly revision: {
      readonly calibrationLabels: ReadonlyArray<{
        readonly annotationName: string;
        readonly explanation: string | null;
        readonly label: string | null;
        readonly score: number | null;
      }>;
      readonly revisionId: string;
    };
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
    "concreteType": "DatasetExampleCalibrationLabelPayload",
    "kind": "LinkedField",
    "name": "setDatasetExampleCalibrationLabel",
    "plural": false,
    "selections": [
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
    "cacheID": "d86b6455ef97af692e36d79003adfa63",
    "id": null,
    "metadata": {},
    "name": "EvaluatorPlaygroundReviewMutation",
    "operationKind": "mutation",
    "text": "mutation EvaluatorPlaygroundReviewMutation(\n  $input: SetDatasetExampleCalibrationLabelInput!\n) {\n  setDatasetExampleCalibrationLabel(input: $input) {\n    revision {\n      revisionId\n      calibrationLabels {\n        annotationName\n        score\n        explanation\n        label\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "2552c7da7ec845de589849c3034273f4";

export default node;
