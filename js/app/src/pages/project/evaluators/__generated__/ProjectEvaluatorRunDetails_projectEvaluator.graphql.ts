/**
 * @generated SignedSource<<44464f88336a88092501c45ec5e02ce3>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type ProjectEvaluatorRunStatus = "FAILING" | "HEALTHY" | "NEVER_RUN" | "QUEUED";
export type ProjectEvaluatorSchedulabilityReason = "DISABLED" | "TRACE_TARGET_UNSUPPORTED";
export type ProjectEvaluatorSchedulabilityStatus = "NOT_SCHEDULABLE" | "SCHEDULABLE";
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorRunDetails_projectEvaluator$data = {
  readonly runSummary: {
    readonly evaluatedCount: number;
    readonly failedCount: number;
    readonly lastError: string | null;
    readonly lastRunAt: string | null;
    readonly queuedCount: number;
    readonly status: ProjectEvaluatorRunStatus;
  };
  readonly schedulabilityReason: ProjectEvaluatorSchedulabilityReason | null;
  readonly schedulabilityStatus: ProjectEvaluatorSchedulabilityStatus;
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
      "name": "schedulabilityStatus",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "schedulabilityReason",
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
          "name": "status",
          "storageKey": null
        },
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

(node as any).hash = "95edda266deb8d8e5ea9eb2e3d73d3be";

export default node;
