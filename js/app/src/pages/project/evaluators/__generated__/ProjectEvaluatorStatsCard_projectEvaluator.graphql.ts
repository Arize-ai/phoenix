/**
 * @generated SignedSource<<a03c61bab83388a7524dd139da70d52e>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type Language = "PYTHON" | "TYPESCRIPT";
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorStatsCard_projectEvaluator$data = {
  readonly createdAt: string;
  readonly evaluator: {
    readonly language?: Language;
  };
  readonly runSummary: {
    readonly evaluatedCount: number;
    readonly failedCount: number;
    readonly lastError: string | null;
    readonly lastRunAt: string | null;
    readonly queuedCount: number;
  };
  readonly " $fragmentType": "ProjectEvaluatorStatsCard_projectEvaluator";
};
export type ProjectEvaluatorStatsCard_projectEvaluator$key = {
  readonly " $data"?: ProjectEvaluatorStatsCard_projectEvaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorStatsCard_projectEvaluator">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ProjectEvaluatorStatsCard_projectEvaluator",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "createdAt",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "ProjectEvaluatorRunSummary",
      "kind": "LinkedField",
      "name": "runSummary",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "lastRunAt",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "queuedCount",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "evaluatedCount",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "failedCount",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "lastError",
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "evaluator",
      "plural": false,
      "selections": [
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "language",
              "storageKey": null
            }
          ],
          "type": "CodeEvaluator",
          "abstractKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "ProjectEvaluator",
  "abstractKey": null
};

(node as any).hash = "6492a4dad38058b36ea7ac2dcad31c82";

export default node;
