/**
 * @generated SignedSource<<a57272f1d595ee689f00d669c82259ac>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TraceTurnContent_rootSpan$data = {
  readonly attributes: string;
  readonly cumulativeTokenCountTotal: number | null;
  readonly endTime: string | null;
  readonly id: string;
  readonly input: {
    readonly value: string;
  } | null;
  readonly latencyMs: number | null;
  readonly output: {
    readonly value: string;
  } | null;
  readonly project: {
    readonly id: string;
  };
  readonly startTime: string;
  readonly trace: {
    readonly costSummary: {
      readonly total: {
        readonly cost: number | null;
      };
    };
    readonly id: string;
    readonly " $fragmentSpreads": FragmentRefs<"TraceAnnotationSummaryGroup" | "TraceFeedbackActionToolbar_trace">;
  };
  readonly " $fragmentSpreads": FragmentRefs<"AnnotationSummaryGroup">;
  readonly " $fragmentType": "TraceTurnContent_rootSpan";
};
export type TraceTurnContent_rootSpan$key = {
  readonly " $data"?: TraceTurnContent_rootSpan$data;
  readonly " $fragmentSpreads": FragmentRefs<"TraceTurnContent_rootSpan">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "value",
    "storageKey": null
  }
];
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "TraceTurnContent_rootSpan",
  "selections": [
    (v0/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "attributes",
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
      "concreteType": "SpanIOValue",
      "kind": "LinkedField",
      "name": "input",
      "plural": false,
      "selections": (v1/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "SpanIOValue",
      "kind": "LinkedField",
      "name": "output",
      "plural": false,
      "selections": (v1/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "cumulativeTokenCountTotal",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "latencyMs",
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
      "concreteType": "Trace",
      "kind": "LinkedField",
      "name": "trace",
      "plural": false,
      "selections": [
        (v0/*:: as any*/),
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
                  "name": "cost",
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        },
        {
          "args": null,
          "kind": "FragmentSpread",
          "name": "TraceAnnotationSummaryGroup"
        },
        {
          "args": null,
          "kind": "FragmentSpread",
          "name": "TraceFeedbackActionToolbar_trace"
        }
      ],
      "storageKey": null
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "AnnotationSummaryGroup"
    }
  ],
  "type": "Span",
  "abstractKey": null
};
})();

(node as any).hash = "8ccce1630f363df021546236a38cdba4";

export default node;
