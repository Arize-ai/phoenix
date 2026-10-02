/**
 * @generated SignedSource<<79d9f067e06b9b175c68e5f24ac2e04e>>
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
];
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
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          },
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
    "cacheID": "ad841d6e1483abad396722aa0a971d8c",
    "id": null,
    "metadata": {},
    "name": "PlaygroundDatasetExamplesTableExpectedOutputsRefetchQuery",
    "operationKind": "query",
    "text": "query PlaygroundDatasetExamplesTableExpectedOutputsRefetchQuery(\n  $splitIds: [ID!]\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...PlaygroundDatasetExamplesTableExpectedOutputsFragment_1Csera\n    id\n  }\n}\n\nfragment PlaygroundDatasetExamplesTableExpectedOutputsFragment_1Csera on Dataset {\n  exampleCount(splitIds: $splitIds)\n  exampleExpectedOutputs(splitIds: $splitIds) {\n    exampleId\n    expectedOutputs {\n      annotationName\n      label\n      score\n      explanation\n    }\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "77d1e4ee256409c016bb41ae10f76aaf";

export default node;
