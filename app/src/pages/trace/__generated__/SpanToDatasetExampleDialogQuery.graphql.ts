/**
 * @generated SignedSource<<338df044f8128e340b20618be5b0638e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type SpanToDatasetExampleDialogQuery$variables = {
  spanId: string;
};
export type SpanToDatasetExampleDialogQuery$data = {
  readonly datasets: {
    readonly edges: ReadonlyArray<{
      readonly dataset: {
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
  readonly span: {
    readonly example?: {
      readonly input: any;
      readonly metadata: any;
      readonly output: any;
    };
  };
};
export type SpanToDatasetExampleDialogQuery = {
  response: SpanToDatasetExampleDialogQuery$data;
  variables: SpanToDatasetExampleDialogQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "spanId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "spanId"
  }
],
v2 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": "example",
      "args": null,
      "concreteType": "SpanAsExample",
      "kind": "LinkedField",
      "name": "asExample",
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
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "metadata",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Span",
  "abstractKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "concreteType": "DatasetConnection",
  "kind": "LinkedField",
  "name": "datasets",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "DatasetEdge",
      "kind": "LinkedField",
      "name": "edges",
      "plural": true,
      "selections": [
        {
          "alias": "dataset",
          "args": null,
          "concreteType": "Dataset",
          "kind": "LinkedField",
          "name": "node",
          "plural": false,
          "selections": [
            (v3/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "name",
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
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SpanToDatasetExampleDialogQuery",
    "selections": [
      {
        "alias": "span",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/)
        ],
        "storageKey": null
      },
      (v4/*: any*/)
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SpanToDatasetExampleDialogQuery",
    "selections": [
      {
        "alias": "span",
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
          (v2/*: any*/),
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          (v3/*: any*/)
        ],
        "storageKey": null
      },
      (v4/*: any*/)
    ]
  },
  "params": {
    "cacheID": "92c7d774726ce530c29360bef748726c",
    "id": null,
    "metadata": {},
    "name": "SpanToDatasetExampleDialogQuery",
    "operationKind": "query",
    "text": "query SpanToDatasetExampleDialogQuery(\n  $spanId: GlobalID!\n) {\n  span: node(id: $spanId) {\n    __typename\n    ... on Span {\n      example: asExample {\n        input\n        output\n        metadata\n      }\n    }\n    __isNode: __typename\n    id\n  }\n  datasets {\n    edges {\n      dataset: node {\n        id\n        name\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "3ea0179203f4d40fb27bd58d845d8fb1";

export default node;
