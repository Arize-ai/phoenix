/**
 * @generated SignedSource<<86bdb05f8861c4b2ba56d1e7083529d8>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorMetrics_projectEvaluator$data = {
  readonly evaluationTarget: EvaluationTarget;
  readonly project: {
    readonly id: string;
  };
  readonly traceProject: {
    readonly id: string;
  };
  readonly tracingEnabled: boolean;
  readonly " $fragmentSpreads": FragmentRefs<"useProjectEvaluatorResultAnnotationsFragment">;
  readonly " $fragmentType": "ProjectEvaluatorMetrics_projectEvaluator";
};
export type ProjectEvaluatorMetrics_projectEvaluator$key = {
  readonly " $data"?: ProjectEvaluatorMetrics_projectEvaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorMetrics_projectEvaluator">;
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
  "name": "ProjectEvaluatorMetrics_projectEvaluator",
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
      "kind": "ScalarField",
      "name": "tracingEnabled",
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
      "args": null,
      "kind": "FragmentSpread",
      "name": "useProjectEvaluatorResultAnnotationsFragment"
    }
  ],
  "type": "ProjectEvaluator",
  "abstractKey": null
};
})();

(node as any).hash = "62ca0524e332fdbd188bb019b28cafa0";

export default node;
