/**
 * @generated SignedSource<<20a3f99f7550ceb9af202b3a37143fe2>>
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
  label?: string | null;
};
export type EvaluatorPlaygroundReviewMutation$variables = {
  input: SetDatasetExampleCalibrationLabelInput;
};
export type EvaluatorPlaygroundReviewMutation$data = {
  readonly setDatasetExampleCalibrationLabel: {
    readonly revision: {
      readonly calibrationLabels: ReadonlyArray<{
        readonly annotationName: string;
        readonly label: string;
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
    "cacheID": "8f18d70daf27f6f1fbd007840eb40a19",
    "id": null,
    "metadata": {},
    "name": "EvaluatorPlaygroundReviewMutation",
    "operationKind": "mutation",
    "text": "mutation EvaluatorPlaygroundReviewMutation(\n  $input: SetDatasetExampleCalibrationLabelInput!\n) {\n  setDatasetExampleCalibrationLabel(input: $input) {\n    revision {\n      revisionId\n      calibrationLabels {\n        annotationName\n        label\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "a3f86e5d425512aa0d6186c5e4824bff";

export default node;
