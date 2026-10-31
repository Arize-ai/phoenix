/**
 * @generated SignedSource<<febc6ecb4bdcdaf67c0edc11d39cf48b>>
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

(node as any).hash = "6c676fb8824e8764dc4282337038c6fa";

export default node;
