/**
 * @generated SignedSource<<d7dc33c33f56fa4393e9123c9b371427>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment, RefetchableFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PlaygroundDatasetExamplesTableFragment$data = {
  readonly examples: {
    readonly edges: ReadonlyArray<{
      readonly example: {
        readonly id: string;
        readonly revision: {
          readonly input: any;
          readonly output: any;
        };
      };
    }>;
  };
  readonly id: string;
  readonly " $fragmentType": "PlaygroundDatasetExamplesTableFragment";
};
export type PlaygroundDatasetExamplesTableFragment$key = {
  readonly " $data"?: PlaygroundDatasetExamplesTableFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"PlaygroundDatasetExamplesTableFragment">;
};

import PlaygroundDatasetExamplesTableRefetchQuery_graphql from './PlaygroundDatasetExamplesTableRefetchQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "examples"
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "after"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "datasetVersionId"
    },
    {
      "defaultValue": 100,
      "kind": "LocalArgument",
      "name": "first"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "first",
        "cursor": "after",
        "direction": "forward",
        "path": (v0/*: any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "first",
          "cursor": "after"
        },
        "backward": null,
        "path": (v0/*: any*/)
      },
      "fragmentPathInResult": [
        "node"
      ],
      "operation": PlaygroundDatasetExamplesTableRefetchQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "PlaygroundDatasetExamplesTableFragment",
  "selections": [
    {
      "alias": "examples",
      "args": [
        {
          "kind": "Variable",
          "name": "datasetVersionId",
          "variableName": "datasetVersionId"
        }
      ],
      "concreteType": "DatasetExampleConnection",
      "kind": "LinkedField",
      "name": "__PlaygroundDatasetExamplesTable_examples_connection",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "DatasetExampleEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": "example",
              "args": null,
              "concreteType": "DatasetExample",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v1/*: any*/),
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "DatasetExampleRevision",
                  "kind": "LinkedField",
                  "name": "revision",
                  "plural": false,
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "input",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "output",
                      "storageKey": null
                    }
                  ],
                  "storageKey": null
                }
              ],
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "cursor",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "DatasetExample",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "__typename",
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        },
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
              "name": "endCursor",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "hasNextPage",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    (v1/*: any*/)
  ],
  "type": "Dataset",
  "abstractKey": null
};
})();

(node as any).hash = "0162da7892a46d0e2eee9857809cd875";

export default node;