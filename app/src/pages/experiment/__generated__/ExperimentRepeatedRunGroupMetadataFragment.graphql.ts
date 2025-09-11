/**
 * @generated SignedSource<<de41c7f71fd279ef019ec7e49fde028a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ExperimentRepeatedRunGroupMetadataFragment$data = {
  readonly averageLatencyMs: number | null;
  readonly costSummary: {
    readonly total: {
      readonly cost: number | null;
      readonly tokens: number | null;
    };
  };
  readonly id: string;
  readonly " $fragmentType": "ExperimentRepeatedRunGroupMetadataFragment";
};
export type ExperimentRepeatedRunGroupMetadataFragment$key = {
  readonly " $data"?: ExperimentRepeatedRunGroupMetadataFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"ExperimentRepeatedRunGroupMetadataFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ExperimentRepeatedRunGroupMetadataFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "averageLatencyMs",
      "storageKey": null
    },
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
    }
  ],
  "type": "ExperimentRepeatedRunGroup",
  "abstractKey": null
};

(node as any).hash = "a5fdac9740fed436ed80e90d5750cb38";

export default node;
