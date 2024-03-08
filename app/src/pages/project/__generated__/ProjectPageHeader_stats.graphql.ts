/**
 * @generated SignedSource<<be91bef1354011680eb90dfb7a005548>>
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
  readonly id: string;
  readonly latencyMsP50: number | null;
  readonly latencyMsP99: number | null;
  readonly spanEvaluationNames: ReadonlyArray<string>;
  readonly tokenCountTotal: number;
  readonly traceCount: number;
  readonly " $fragmentType": "ProjectPageHeader_stats";
};
export type ProjectPageHeader_stats$key = {
  readonly " $data"?: ProjectPageHeader_stats$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectPageHeader_stats">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [
        "node"
      ],
      "operation": require('./ProjectPageHeaderQuery.graphql'),
      "identifierField": "id"
    }
  },
  "name": "ProjectPageHeader_stats",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "traceCount",
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
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};

(node as any).hash = "e18ca825b86a66619e25ff123f147ff4";

export default node;
