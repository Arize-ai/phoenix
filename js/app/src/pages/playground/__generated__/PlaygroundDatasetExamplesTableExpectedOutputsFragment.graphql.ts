/**
 * @generated SignedSource<<2a5923aad2d233204354bd2e86d9efc2>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PlaygroundDatasetExamplesTableExpectedOutputsFragment$data = {
  readonly exampleCount: number;
  readonly exampleExpectedOutputs: ReadonlyArray<{
    readonly exampleId: string;
    readonly expectedOutputs: ReadonlyArray<{
      readonly annotationName: string;
      readonly explanation: string | null;
      readonly label: string | null;
      readonly score: number | null;
    }>;
    readonly id: string;
  }>;
  readonly id: string;
  readonly " $fragmentType": "PlaygroundDatasetExamplesTableExpectedOutputsFragment";
};
export type PlaygroundDatasetExamplesTableExpectedOutputsFragment$key = {
  readonly " $data"?: PlaygroundDatasetExamplesTableExpectedOutputsFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"PlaygroundDatasetExamplesTableExpectedOutputsFragment">;
};

import PlaygroundDatasetExamplesTableExpectedOutputsRefetchQuery_graphql from './PlaygroundDatasetExamplesTableExpectedOutputsRefetchQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  {
    "kind": "Variable",
    "name": "splitIds",
    "variableName": "splitIds"
  }
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
      "args": (v0/*:: as any*/),
      "kind": "ScalarField",
      "name": "exampleCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": (v0/*:: as any*/),
      "concreteType": "DatasetExampleExpectedOutputs",
      "kind": "LinkedField",
      "name": "exampleExpectedOutputs",
      "plural": true,
      "selections": [
        (v1/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "exampleId",
          "storageKey": null
        },
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
    },
    (v1/*:: as any*/)
  ],
  "type": "Dataset",
  "abstractKey": null
};
})();

(node as any).hash = "860547bd98334b559fcf4093ff66da4c";

export default node;
