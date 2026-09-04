/**
 * @generated SignedSource<<0da369c9c8491a01cc8bc51e9904f164>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
export type ProjectEvaluatorSchedulabilityReason = "DISABLED";
export type ProjectEvaluatorSchedulabilityStatus = "NOT_SCHEDULABLE" | "SCHEDULABLE";
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorScopeDetails_projectEvaluator$data = {
  readonly evaluationDelaySeconds: number;
  readonly evaluationTarget: EvaluationTarget;
  readonly filterCondition: string;
  readonly samplingRate: number;
  readonly schedulabilityReason: ProjectEvaluatorSchedulabilityReason | null;
  readonly schedulabilityStatus: ProjectEvaluatorSchedulabilityStatus;
  readonly " $fragmentType": "ProjectEvaluatorScopeDetails_projectEvaluator";
};
export type ProjectEvaluatorScopeDetails_projectEvaluator$key = {
  readonly " $data"?: ProjectEvaluatorScopeDetails_projectEvaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorScopeDetails_projectEvaluator">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ProjectEvaluatorScopeDetails_projectEvaluator",
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
      "name": "filterCondition",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "samplingRate",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "evaluationDelaySeconds",
      "storageKey": null
    },
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
    }
  ],
  "type": "ProjectEvaluator",
  "abstractKey": null
};

(node as any).hash = "0d20a79f97199a3b9a330e4d26df794c";

export default node;
