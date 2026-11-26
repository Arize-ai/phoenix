/**
 * @generated SignedSource<<03c25910cb1f04774b838b542063fcc0>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type ExperimentRunAnnotatorKind = "AGENT" | "CODE" | "DECISION" | "HUMAN" | "LLM";
import { FragmentRefs } from "relay-runtime";
export type useExperimentCompareLaneRunGroup_runGroup$data = {
  readonly averageLatencyMs: number | null;
  readonly costSummary: {
    readonly total: {
      readonly cost: number | null;
      readonly tokens: number | null;
    };
  };
  readonly id: string;
  readonly runs: ReadonlyArray<{
    readonly annotations: {
      readonly edges: ReadonlyArray<{
        readonly annotation: {
          readonly annotatorKind: ExperimentRunAnnotatorKind;
          readonly explanation: string | null;
          readonly id: string;
          readonly label: string | null;
          readonly metadata: any;
          readonly name: string;
          readonly score: number | null;
          readonly trace: {
            readonly projectId: string;
            readonly traceId: string;
          } | null;
        };
      }>;
    };
    readonly costSummary: {
      readonly total: {
        readonly cost: number | null;
        readonly tokens: number | null;
      };
    };
    readonly error: string | null;
    readonly id: string;
    readonly latencyMs: number;
    readonly output: any | null;
    readonly repetitionNumber: number;
    readonly trace: {
      readonly projectId: string;
      readonly traceId: string;
    } | null;
  }>;
  readonly " $fragmentType": "useExperimentCompareLaneRunGroup_runGroup";
};
export type useExperimentCompareLaneRunGroup_runGroup$key = {
  readonly " $data"?: useExperimentCompareLaneRunGroup_runGroup$data;
  readonly " $fragmentSpreads": FragmentRefs<"useExperimentCompareLaneRunGroup_runGroup">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = {
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
          "name": "tokens",
          "storageKey": null
        },
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
v2 = {
  "alias": null,
  "args": null,
  "concreteType": "Trace",
  "kind": "LinkedField",
  "name": "trace",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "traceId",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "projectId",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "useExperimentCompareLaneRunGroup_runGroup",
  "selections": [
    (v0/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "averageLatencyMs",
      "storageKey": null
    },
    (v1/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "ExperimentRun",
      "kind": "LinkedField",
      "name": "runs",
      "plural": true,
      "selections": [
        (v0/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "repetitionNumber",
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
          "name": "output",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "error",
          "storageKey": null
        },
        (v2/*:: as any*/),
        (v1/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": "ExperimentRunAnnotationConnection",
          "kind": "LinkedField",
          "name": "annotations",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "ExperimentRunAnnotationEdge",
              "kind": "LinkedField",
              "name": "edges",
              "plural": true,
              "selections": [
                {
                  "alias": "annotation",
                  "args": null,
                  "concreteType": "ExperimentRunAnnotation",
                  "kind": "LinkedField",
                  "name": "node",
                  "plural": false,
                  "selections": [
                    (v0/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "name",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "score",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "label",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "annotatorKind",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "explanation",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "metadata",
                      "storageKey": null
                    },
                    (v2/*:: as any*/)
                  ],
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "ExperimentRepeatedRunGroup",
  "abstractKey": null
};
})();

(node as any).hash = "0c19dd57e22d53000baadf20c107c30e";

export default node;
