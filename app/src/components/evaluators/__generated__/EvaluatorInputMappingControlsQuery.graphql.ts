/**
 * @generated SignedSource<<c9b50a68badeb626a9a0dc04370e3a35>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EvaluatorInputMappingControlsQuery$variables = {
  exampleId: string;
  hasExample: boolean;
};
export type EvaluatorInputMappingControlsQuery$data = {
  readonly example?: {
    readonly revision?: {
      readonly " $fragmentSpreads": FragmentRefs<"utils_datasetExampleToEvaluatorInput_example">;
    };
  };
};
export type EvaluatorInputMappingControlsQuery = {
  response: EvaluatorInputMappingControlsQuery$data;
  variables: EvaluatorInputMappingControlsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "exampleId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "hasExample"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "exampleId"
  }
],
v2 = [
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
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EvaluatorInputMappingControlsQuery",
    "selections": [
      {
        "condition": "hasExample",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": "example",
            "args": (v1/*: any*/),
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
                    "concreteType": "DatasetExampleRevision",
                    "kind": "LinkedField",
                    "name": "revision",
                    "plural": false,
                    "selections": [
                      {
                        "kind": "InlineDataFragmentSpread",
                        "name": "utils_datasetExampleToEvaluatorInput_example",
                        "selections": (v2/*: any*/),
                        "args": null,
                        "argumentDefinitions": []
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "type": "DatasetExample",
                "abstractKey": null
              }
            ],
            "storageKey": null
          }
        ]
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "EvaluatorInputMappingControlsQuery",
    "selections": [
      {
        "condition": "hasExample",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": "example",
            "args": (v1/*: any*/),
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
                "kind": "InlineFragment",
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DatasetExampleRevision",
                    "kind": "LinkedField",
                    "name": "revision",
                    "plural": false,
                    "selections": (v2/*: any*/),
                    "storageKey": null
                  }
                ],
                "type": "DatasetExample",
                "abstractKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "id",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ]
      }
    ]
  },
  "params": {
    "cacheID": "30a8ab4722a3b717986aed3932e5ccb9",
    "id": null,
    "metadata": {},
    "name": "EvaluatorInputMappingControlsQuery",
    "operationKind": "query",
    "text": "query EvaluatorInputMappingControlsQuery(\n  $exampleId: ID!\n  $hasExample: Boolean!\n) {\n  example: node(id: $exampleId) @include(if: $hasExample) {\n    __typename\n    ... on DatasetExample {\n      revision {\n        ...utils_datasetExampleToEvaluatorInput_example\n      }\n    }\n    id\n  }\n}\n\nfragment utils_datasetExampleToEvaluatorInput_example on DatasetExampleRevision {\n  input\n  output\n}\n"
  }
};
})();

(node as any).hash = "d726ebaf5d46c84c4dbe4fe5c53b41fd";

export default node;
