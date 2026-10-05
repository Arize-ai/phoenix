/**
 * @generated SignedSource<<605dd3c20661f52626e8f27d0a817dce>>
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
  };
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
      "alias": "allExamples",
      "args": [
        {
          "kind": "Literal",
          "name": "first",
          "value": 1000
        },
        {
          "kind": "Variable",
          "name": "splitIds",
          "variableName": "splitIds"
        }
      ],
      "concreteType": "DatasetExampleConnection",
      "kind": "LinkedField",
      "name": "examples",
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
                (v0/*:: as any*/),
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
    (v0/*:: as any*/)
  ],
  "type": "Dataset",
  "abstractKey": null
};
})();

(node as any).hash = "bc45f571a6e564b4ac14b9e2c498c576";

export default node;
