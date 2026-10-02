/**
 * @generated SignedSource<<5181daad02a95f90818c63ffa98795d0>>
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
];
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
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    }
  ],
  "type": "Dataset",
  "abstractKey": null
};
})();

(node as any).hash = "77d1e4ee256409c016bb41ae10f76aaf";

export default node;
