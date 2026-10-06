/**
 * @generated SignedSource<<5baf5219e8e1e76cb256fd4d596b9940>>
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
v3 = {
  "kind": "Variable",
  "name": "splitIds",
  "variableName": "splitIds"
},
v4 = [
  (v3/*:: as any*/)
],
v5 = {
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
            "args": (v4/*:: as any*/),
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
          (v5/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v4/*:: as any*/),
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
                  (v3/*:: as any*/)
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
                          (v5/*:: as any*/),
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
    "cacheID": "23f07008b5e2aa8f2663e77ba74cd77d",
    "id": null,
    "metadata": {},
    "name": "PlaygroundDatasetExamplesTableExpectedOutputsRefetchQuery",
    "operationKind": "query",
    "text": "query PlaygroundDatasetExamplesTableExpectedOutputsRefetchQuery(\n  $splitIds: [ID!]\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...PlaygroundDatasetExamplesTableExpectedOutputsFragment_1Csera\n    id\n  }\n}\n\nfragment PlaygroundDatasetExamplesTableExpectedOutputsFragment_1Csera on Dataset {\n  exampleCount(splitIds: $splitIds)\n  allExamples: examples(splitIds: $splitIds, first: 1000) {\n    pageInfo {\n      hasNextPage\n    }\n    edges {\n      example: node {\n        id\n        revision {\n          expectedOutputs {\n            annotationName\n            label\n            score\n            explanation\n          }\n        }\n      }\n    }\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "e3f1f0212ca32ae7e258ed82f5a6a54c";

export default node;
