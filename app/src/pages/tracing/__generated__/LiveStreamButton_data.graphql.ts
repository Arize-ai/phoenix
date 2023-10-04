/**
 * @generated SignedSource<<897bf0aaecad2abccba5565d3e174b17>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment, RefetchableFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type LiveStreamButton_data$data = {
  readonly traceCount: {
    readonly pageInfo: {
      readonly totalCount: number;
    };
  };
  readonly " $fragmentType": "LiveStreamButton_data";
};
export type LiveStreamButton_data$key = {
  readonly " $data"?: LiveStreamButton_data$data;
  readonly " $fragmentSpreads": FragmentRefs<"LiveStreamButton_data">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [],
      "operation": require('./LiveStreamButtonRefetchQuery.graphql')
    }
  },
  "name": "LiveStreamButton_data",
  "selections": [
    {
      "alias": "traceCount",
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
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "96942eb23b7285a8b31284cda62a9f93";

export default node;
