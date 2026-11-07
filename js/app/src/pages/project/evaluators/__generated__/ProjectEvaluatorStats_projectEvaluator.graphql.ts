/**
 * @generated SignedSource<<f88601ebbc70a0656ec85e4fd40b6226>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
export type ProjectEvaluatorRunStatus = "DEGRADED" | "DISABLED" | "ERROR" | "HEALTHY" | "NEVER_RUN" | "STARTING";
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorStats_projectEvaluator$data = {
  readonly createdAt: string;
  readonly evaluationLoad: {
    readonly evaluationCount: number;
    readonly meanEvaluationSeconds: number | null;
    readonly shareOfEvaluationTime: number | null;
  };
  readonly evaluationTarget: EvaluationTarget;
  readonly id: string;
  readonly project: {
    readonly id: string;
  };
  readonly runSummary: {
    readonly lastError: string | null;
    readonly lastRunAt: string | null;
    readonly oldestWaitingOrRetryingAt: string | null;
    readonly queuedCount: number;
    readonly status: ProjectEvaluatorRunStatus;
  };
  readonly " $fragmentSpreads": FragmentRefs<"useProjectEvaluatorResultAnnotationsFragment">;
  readonly " $fragmentType": "ProjectEvaluatorStats_projectEvaluator";
};
export type ProjectEvaluatorStats_projectEvaluator$key = {
  readonly " $data"?: ProjectEvaluatorStats_projectEvaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorStats_projectEvaluator">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ProjectEvaluatorStats_projectEvaluator",
  "selections": [
    (v0/*:: as any*/),
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
      "kind": "ScalarField",
      "name": "evaluationTarget",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "Project",
      "kind": "LinkedField",
      "name": "project",
      "plural": false,
      "selections": [
        (v0/*:: as any*/)
      ],
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
          "name": "oldestWaitingOrRetryingAt",
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
      "concreteType": "ProjectEvaluatorEvaluationLoad",
      "kind": "LinkedField",
      "name": "evaluationLoad",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "evaluationCount",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "meanEvaluationSeconds",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "shareOfEvaluationTime",
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "useProjectEvaluatorResultAnnotationsFragment"
    }
  ],
  "type": "ProjectEvaluator",
  "abstractKey": null
};
})();

(node as any).hash = "02a2cbae677ddfd35d6b49cfbbfbea20";

export default node;
