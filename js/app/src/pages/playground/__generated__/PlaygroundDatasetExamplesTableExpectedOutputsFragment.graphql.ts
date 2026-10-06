/**
 * @generated SignedSource<<cb07a04173dad32194c43a6e9676f465>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PlaygroundDatasetExamplesTableExpectedOutputsFragment$data = {
  readonly allExamples: {
    readonly edges: ReadonlyArray<{
      readonly example: {
        readonly id: string;
        readonly revision: {
          readonly expectedOutputs: ReadonlyArray<{
            readonly annotationName: string;
            readonly explanation: string | null;
            readonly label: string | null;
            readonly score: number | null;
          }>;
        };
      };
    }>;
    readonly pageInfo: {
      readonly hasNextPage: boolean;
    };
  };
  readonly exampleCount: number;
  readonly id: string;
  readonly " $fragmentType": "PlaygroundDatasetExamplesTableExpectedOutputsFragment";
};
export type PlaygroundDatasetExamplesTableExpectedOutputsFragment$key = {
  readonly " $data"?: PlaygroundDatasetExamplesTableExpectedOutputsFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"PlaygroundDatasetExamplesTableExpectedOutputsFragment">;
};

import PlaygroundDatasetExamplesTableExpectedOutputsRefetchQuery_graphql from './PlaygroundDatasetExamplesTableExpectedOutputsRefetchQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = {
  "kind": "Variable",
  "name": "splitIds",
  "variableName": "splitIds"
},
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
      "name": "splitIds"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [
        "node"
      ],
      "operation": PlaygroundDatasetExamplesTableExpectedOutputsRefetchQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "PlaygroundDatasetExamplesTableExpectedOutputsFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        (v0/*:: as any*/)
      ],
      "kind": "ScalarField",
      "name": "exampleCount",
      "storageKey": null
    },
    {
      "alias": "allExamples",
      "args": [
        {
          "kind": "Literal",
          "name": "first",
          "value": 1000
        },
        (v0/*:: as any*/)
      ],
      "concreteType": "DatasetExampleConnection",
      "kind": "LinkedField",
      "name": "examples",
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
              "name": "hasNextPage",
              "storageKey": null
            }
          ],
          "storageKey": null
        },
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
                (v1/*:: as any*/),
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
                      "concreteType": "DatasetExampleExpectedOutput",
                      "kind": "LinkedField",
                      "name": "expectedOutputs",
                      "plural": true,
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "annotationName",
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
                          "name": "score",
                          "storageKey": null
                        },
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "explanation",
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
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    (v1/*:: as any*/)
  ],
  "type": "Dataset",
  "abstractKey": null
};
})();

(node as any).hash = "e3f1f0212ca32ae7e258ed82f5a6a54c";

export default node;
