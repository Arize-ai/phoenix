/**
 * @generated SignedSource<<1e9980762607ef207a89a19e8c5d392c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ExperimentRunMetadata_runs$data = {
  readonly runs: ReadonlyArray<{
    readonly costSummary: {
      readonly total: {
        readonly cost: number | null;
        readonly tokens: number | null;
      };
    };
    readonly endTime: string;
    readonly id: string;
    readonly repetitionNumber: number;
    readonly startTime: string;
  }>;
  readonly " $fragmentType": "ExperimentRunMetadata_runs";
};
export type ExperimentRunMetadata_runs$key = {
  readonly " $data"?: ExperimentRunMetadata_runs$data;
  readonly " $fragmentSpreads": FragmentRefs<"ExperimentRunMetadata_runs">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ExperimentRunMetadata_runs",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "ExperimentRun",
      "kind": "LinkedField",
      "name": "runs",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "repetitionNumber",
          "storageKey": null
        },
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
          "kind": "ScalarField",
          "name": "startTime",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "endTime",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "SpanCostSummary",
          "kind": "LinkedField",
          "name": "costSummary",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "CostBreakdown",
              "kind": "LinkedField",
              "name": "total",
              "plural": false,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "tokens",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "cost",
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
  "type": "RunComparisonItem",
  "abstractKey": null
};

(node as any).hash = "7f44e90766e1b164876afd2b7eb427c1";

export default node;
