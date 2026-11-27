/**
 * @generated SignedSource<<d6b29a47fe939d968f960ee9612e2b13>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ExperimentCompareExampleRevisionCardQuery$variables = {
  datasetVersionId: string;
  exampleId: string;
};
export type ExperimentCompareExampleRevisionCardQuery$data = {
  readonly example: {
    readonly revision?: {
      readonly input: any;
      readonly referenceOutput: any;
    };
  };
};
export type ExperimentCompareExampleRevisionCardQuery = {
  response: ExperimentCompareExampleRevisionCardQuery$data;
  variables: ExperimentCompareExampleRevisionCardQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetVersionId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "exampleId"
},
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "exampleId"
  }
],
v3 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "datasetVersionId",
          "variableName": "datasetVersionId"
        }
      ],
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
          "alias": "referenceOutput",
          "args": null,
          "kind": "ScalarField",
          "name": "output",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "DatasetExample",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ExperimentCompareExampleRevisionCardQuery",
    "selections": [
      {
        "alias": "example",
        "args": (v2/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v3/*:: as any*/)
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
    "name": "ExperimentCompareExampleRevisionCardQuery",
    "selections": [
      {
        "alias": "example",
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
          (v3/*:: as any*/),
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
  },
  "params": {
    "cacheID": "4e1c87307f782fc2f184676c95a922ef",
    "id": null,
    "metadata": {},
    "name": "ExperimentCompareExampleRevisionCardQuery",
    "operationKind": "query",
    "text": "query ExperimentCompareExampleRevisionCardQuery(\n  $exampleId: ID!\n  $datasetVersionId: ID!\n) {\n  example: node(id: $exampleId) {\n    __typename\n    ... on DatasetExample {\n      revision(datasetVersionId: $datasetVersionId) {\n        input\n        referenceOutput: output\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "a06da2f1a60a660d1887e28c5f31ce3f";

export default node;
