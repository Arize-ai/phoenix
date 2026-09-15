/**
 * @generated SignedSource<<9b38b2e98d07dc5da1c58f5777c7fde5>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type ProjectEvaluatorRunStatus = "ERROR" | "NEVER_RUN" | "QUEUED" | "RUNNING";
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorStats_projectEvaluator$data = {
  readonly createdAt: string;
  readonly evaluationTarget: EvaluationTarget;
  readonly evaluator: {
    readonly kind: EvaluatorKind;
  };
  readonly project: {
    readonly id: string;
  };
  readonly runSummary: {
    readonly droppedCount: number;
    readonly evaluatedCount: number;
    readonly failedCount: number;
    readonly lastError: string | null;
    readonly lastRunAt: string | null;
    readonly queuedCount: number;
    readonly status: ProjectEvaluatorRunStatus;
  };
  readonly traceProject: {
    readonly id: string;
  };
  readonly " $fragmentSpreads": FragmentRefs<"useProjectEvaluatorResultAnnotationsFragment">;
  readonly " $fragmentType": "ProjectEvaluatorStats_projectEvaluator";
};
export type ProjectEvaluatorStats_projectEvaluator$key = {
  readonly " $data"?: ProjectEvaluatorStats_projectEvaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorStats_projectEvaluator">;
};

const node: ReaderFragment = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "id",
    "storageKey": null
  }
];
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ProjectEvaluatorStats_projectEvaluator",
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
      "selections": (v0/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "Project",
      "kind": "LinkedField",
      "name": "traceProject",
      "plural": false,
      "selections": (v0/*:: as any*/),
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
          "name": "droppedCount",
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
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "kind",
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

(node as any).hash = "25bb14ad8a6acf10fd19699d02866397";

export default node;
