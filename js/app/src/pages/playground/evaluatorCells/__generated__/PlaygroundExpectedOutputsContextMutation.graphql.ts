/**
 * @generated SignedSource<<fd149bfb935cfe73c5e43726e0432520>>
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
export type PlaygroundExpectedOutputsContextMutation$variables = {
  input: SetDatasetExampleCalibrationLabelsInput;
};
export type PlaygroundExpectedOutputsContextMutation$data = {
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
    "cacheID": "256b2f23f1d7e15282f3dba29f5e6ea9",
    "id": null,
    "metadata": {},
    "name": "PlaygroundExpectedOutputsContextMutation",
    "operationKind": "mutation",
    "text": "mutation PlaygroundExpectedOutputsContextMutation(\n  $input: SetDatasetExampleCalibrationLabelsInput!\n) {\n  setDatasetExampleCalibrationLabels(input: $input) {\n    examples {\n      id\n      revision {\n        revisionId\n        calibrationLabels {\n          annotationName\n          label\n          score\n          explanation\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "96601ebc0645f0a3ae8f71ff2f1d41e6";

export default node;
