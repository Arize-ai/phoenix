/**
 * @generated SignedSource<<844aee25b4e12189a18c8276bcd8133f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PlaygroundDatasetExamplesTableExpectedOutputsRefetchQuery$variables = {
  id: string;
  splitIds?: ReadonlyArray<string> | null;
};
export type PlaygroundDatasetExamplesTableExpectedOutputsRefetchQuery$data = {
  readonly node: {
    readonly " $fragmentSpreads": FragmentRefs<"PlaygroundDatasetExamplesTableExpectedOutputsFragment">;
  };
};
export type PlaygroundDatasetExamplesTableExpectedOutputsRefetchQuery = {
  response: PlaygroundDatasetExamplesTableExpectedOutputsRefetchQuery$data;
  variables: PlaygroundDatasetExamplesTableExpectedOutputsRefetchQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "splitIds"
},
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v3 = [
  {
    "kind": "Variable",
    "name": "splitIds",
    "variableName": "splitIds"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "PlaygroundDatasetExamplesTableExpectedOutputsRefetchQuery",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "args": (v3/*:: as any*/),
            "kind": "FragmentSpread",
            "name": "PlaygroundDatasetExamplesTableExpectedOutputsFragment"
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "PlaygroundDatasetExamplesTableExpectedOutputsRefetchQuery",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": null,
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
          },
          (v4/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v3/*:: as any*/),
                "kind": "ScalarField",
                "name": "exampleCount",
                "storageKey": null
              },
              {
                "alias": null,
                "args": (v3/*:: as any*/),
                "concreteType": "DatasetExampleExpectedOutputs",
                "kind": "LinkedField",
                "name": "exampleExpectedOutputs",
                "plural": true,
                "selections": [
                  (v4/*:: as any*/),
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
              }
            ],
            "type": "Dataset",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "886b3e233d13789404c177f3f8beb10b",
    "id": null,
    "metadata": {},
    "name": "PlaygroundDatasetExamplesTableExpectedOutputsRefetchQuery",
    "operationKind": "query",
    "text": "query PlaygroundDatasetExamplesTableExpectedOutputsRefetchQuery(\n  $splitIds: [ID!]\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...PlaygroundDatasetExamplesTableExpectedOutputsFragment_1Csera\n    id\n  }\n}\n\nfragment PlaygroundDatasetExamplesTableExpectedOutputsFragment_1Csera on Dataset {\n  exampleCount(splitIds: $splitIds)\n  exampleExpectedOutputs(splitIds: $splitIds) {\n    id\n    exampleId\n    expectedOutputs {\n      annotationName\n      label\n      score\n      explanation\n    }\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "860547bd98334b559fcf4093ff66da4c";

export default node;
