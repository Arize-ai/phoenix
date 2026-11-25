/**
 * @generated SignedSource<<4016f2c6eb23230e933f58f7c890a889>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DocumentEvaluationSummaryValueFragment$data = {
  readonly documentEvaluationSummary: {
    readonly averageNdcg: number | null;
    readonly averagePrecision: number | null;
    readonly hitRate: number | null;
    readonly meanReciprocalRank: number | null;
  } | null;
  readonly " $fragmentType": "DocumentEvaluationSummaryValueFragment";
};
export type DocumentEvaluationSummaryValueFragment$key = {
  readonly " $data"?: DocumentEvaluationSummaryValueFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"DocumentEvaluationSummaryValueFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "evaluationName"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "timeRange"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "DocumentEvaluationSummaryValueFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "evaluationName",
          "variableName": "evaluationName"
        },
        {
          "kind": "Variable",
          "name": "timeRange",
          "variableName": "timeRange"
        }
      ],
      "concreteType": "DocumentEvaluationSummary",
      "kind": "LinkedField",
      "name": "documentEvaluationSummary",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "averageNdcg",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "averagePrecision",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "meanReciprocalRank",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "hitRate",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};

(node as any).hash = "916f1f9ea2d8864e8042e56b822140f0";

export default node;
