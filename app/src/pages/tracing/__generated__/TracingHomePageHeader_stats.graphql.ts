/**
 * @generated SignedSource<<84642d1ed540a6aeb64bda24707d0050>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment, RefetchableFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TracingHomePageHeader_stats$data = {
  readonly totalTraces: {
    readonly pageInfo: {
      readonly totalCount: number;
    };
  };
  readonly traceDatasetInfo: {
    readonly endTime: string;
    readonly latencyMsP50: number | null;
    readonly latencyMsP99: number | null;
    readonly startTime: string;
    readonly tokenCountTotal: number;
  } | null;
  readonly " $fragmentType": "TracingHomePageHeader_stats";
};
export type TracingHomePageHeader_stats$key = {
  readonly " $data"?: TracingHomePageHeader_stats$data;
  readonly " $fragmentSpreads": FragmentRefs<"TracingHomePageHeader_stats">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [],
      "operation": require('./TracingHomePageHeaderQuery.graphql')
    }
  },
  "name": "TracingHomePageHeader_stats",
  "selections": [
    {
      "alias": "totalTraces",
      "args": [
        {
          "kind": "Literal",
          "name": "rootSpansOnly",
          "value": true
        }
      ],
      "concreteType": "SpanConnection",
      "kind": "LinkedField",
      "name": "spans",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "PageInfo",
          "kind": "LinkedField",
          "name": "pageInfo",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "totalCount",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": "spans(rootSpansOnly:true)"
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "TraceDatasetInfo",
      "kind": "LinkedField",
      "name": "traceDatasetInfo",
      "plural": false,
      "selections": [
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
          "kind": "ScalarField",
          "name": "tokenCountTotal",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "latencyMsP50",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "latencyMsP99",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "2f4140d22a5444b5a9fea58801814504";

export default node;
