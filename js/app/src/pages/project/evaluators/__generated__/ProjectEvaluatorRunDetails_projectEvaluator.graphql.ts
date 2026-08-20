/**
 * @generated SignedSource<<bbcc096c93f6903931550d1643e0dd21>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorRunDetails_projectEvaluator$data = {
  readonly evaluationTarget: EvaluationTarget;
  readonly runSummary: {
    readonly evaluatedCount: number;
    readonly failedCount: number;
    readonly lastError: string | null;
    readonly lastRunAt: string | null;
    readonly queuedCount: number;
  };
  readonly " $fragmentType": "ProjectEvaluatorRunDetails_projectEvaluator";
};
export type ProjectEvaluatorRunDetails_projectEvaluator$key = {
  readonly " $data"?: ProjectEvaluatorRunDetails_projectEvaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorRunDetails_projectEvaluator">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ProjectEvaluatorRunDetails_projectEvaluator",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "evaluationTarget",
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
    }
  ],
  "type": "ProjectEvaluator",
  "abstractKey": null
};

(node as any).hash = "cb21c9f63570bed6ddaf669059ecce88";

export default node;
