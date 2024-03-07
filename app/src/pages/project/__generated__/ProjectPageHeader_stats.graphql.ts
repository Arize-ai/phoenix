/**
 * @generated SignedSource<<7560bcf97be5594273c89f98039f8ef0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment, RefetchableFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectPageHeader_stats$data = {
  readonly documentEvaluationNames: ReadonlyArray<string>;
  readonly project: {
    readonly latencyMsP50?: number | null;
    readonly latencyMsP99?: number | null;
    readonly tokenCountTotal?: number;
  };
  readonly spanEvaluationNames: ReadonlyArray<string>;
  readonly totalTraces: {
    readonly pageInfo: {
      readonly totalCount: number;
    };
  };
  readonly " $fragmentType": "ProjectPageHeader_stats";
};
export type ProjectPageHeader_stats$key = {
  readonly " $data"?: ProjectPageHeader_stats$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectPageHeader_stats">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [
    {
      "kind": "RootArgument",
      "name": "projectId"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [],
      "operation": require('./ProjectPageHeaderQuery.graphql')
    }
  },
  "name": "ProjectPageHeader_stats",
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
      "alias": "project",
      "args": [
        {
          "kind": "Variable",
          "name": "id",
          "variableName": "projectId"
        }
      ],
      "concreteType": null,
      "kind": "LinkedField",
      "name": "node",
      "plural": false,
      "selections": [
        {
          "kind": "InlineFragment",
          "selections": [
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
          "type": "Project",
          "abstractKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "spanEvaluationNames",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "documentEvaluationNames",
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "5f21b34435eb35302b40edaafa608240";

export default node;
