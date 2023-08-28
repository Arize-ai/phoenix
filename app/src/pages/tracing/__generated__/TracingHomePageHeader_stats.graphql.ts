/**
 * @generated SignedSource<<2d35f0ffbeab5b8c18be04a911dfafcf>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TracingHomePageHeader_stats$data = {
  readonly totalSpans: {
    readonly pageInfo: {
      readonly totalCount: number;
    };
  };
  readonly totalTraces: {
    readonly pageInfo: {
      readonly totalCount: number;
    };
  };
  readonly traceDatasetInfo: {
    readonly endTime: string;
    readonly startTime: string;
  } | null;
  readonly " $fragmentType": "TracingHomePageHeader_stats";
};
export type TracingHomePageHeader_stats$key = {
  readonly " $data"?: TracingHomePageHeader_stats$data;
  readonly " $fragmentSpreads": FragmentRefs<"TracingHomePageHeader_stats">;
};

const node: ReaderFragment = (function(){
var v0 = [
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
];
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "TracingHomePageHeader_stats",
  "selections": [
    {
      "alias": "totalSpans",
      "args": null,
      "concreteType": "SpanConnection",
      "kind": "LinkedField",
      "name": "spans",
      "plural": false,
      "selections": (v0/*: any*/),
      "storageKey": null
    },
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
      "selections": (v0/*: any*/),
      "storageKey": "spans(rootSpansOnly:true)"
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "DatasetInfo",
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
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "ddb3ece9faf5d20222ae5999ee1e1fd3";

export default node;
