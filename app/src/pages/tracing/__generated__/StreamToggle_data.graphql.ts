/**
 * @generated SignedSource<<27f37bb637dc3baaafb73e51b944a197>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment, RefetchableFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type StreamToggle_data$data = {
  readonly traceCount: {
    readonly pageInfo: {
      readonly totalCount: number;
    };
  };
  readonly " $fragmentType": "StreamToggle_data";
};
export type StreamToggle_data$key = {
  readonly " $data"?: StreamToggle_data$data;
  readonly " $fragmentSpreads": FragmentRefs<"StreamToggle_data">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [],
      "operation": require('./StreamToggleRefetchQuery.graphql')
    }
  },
  "name": "StreamToggle_data",
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

(node as any).hash = "e406600d5729deabc496989862c402e1";

export default node;
