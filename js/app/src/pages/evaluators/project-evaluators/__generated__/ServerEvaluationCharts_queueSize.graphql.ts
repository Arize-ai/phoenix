/**
 * @generated SignedSource<<10cd9c5ab6658a8691d40f267a691b85>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ServerEvaluationCharts_queueSize$data = {
  readonly queueSizeActivity?: {
    readonly series: ReadonlyArray<{
      readonly queueSize: number;
      readonly timestamp: string;
    }>;
  };
  readonly " $fragmentType": "ServerEvaluationCharts_queueSize";
};
export type ServerEvaluationCharts_queueSize$key = {
  readonly " $data"?: ServerEvaluationCharts_queueSize$data;
  readonly " $fragmentSpreads": FragmentRefs<"ServerEvaluationCharts_queueSize">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "includeQueueSize"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "timeBinConfig"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "timeRange"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "ServerEvaluationCharts_queueSize",
  "selections": [
    {
      "condition": "includeQueueSize",
      "kind": "Condition",
      "passingValue": true,
      "selections": [
        {
          "alias": "queueSizeActivity",
          "args": [
            {
              "kind": "Variable",
              "name": "timeBinConfig",
              "variableName": "timeBinConfig"
            },
            {
              "kind": "Variable",
              "name": "timeRange",
              "variableName": "timeRange"
            }
          ],
          "concreteType": "EvaluationActivity",
          "kind": "LinkedField",
          "name": "evaluationActivity",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "EvaluationActivityBin",
              "kind": "LinkedField",
              "name": "series",
              "plural": true,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "timestamp",
                  "storageKey": null
                },
                {
                  "kind": "RequiredField",
                  "field": {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "queueSize",
                    "storageKey": null
                  },
                  "action": "THROW"
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ]
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "bc9f71373e721bb526b9b6e92a491e7a";

export default node;
