/**
 * @generated SignedSource<<d4d723708a315e2aa8ad292e7fa432bc>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SpanToDatasetExampleDialogQuery$variables = {
  spanId: string;
};
export type SpanToDatasetExampleDialogQuery$data = {
  readonly span: {
    readonly revision?: {
      readonly input: any;
      readonly metadata: any;
      readonly output: any;
    };
  };
  readonly " $fragmentSpreads": FragmentRefs<"DatasetPicker__datasets">;
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
      "alias": "revision",
      "args": null,
      "concreteType": "SpanAsExampleRevision",
      "kind": "LinkedField",
      "name": "asExampleRevision",
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
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "DatasetPicker__datasets"
      }
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
      {
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
      }
    ]
  },
  "params": {
    "cacheID": "340325aadd2b2d81cb509e6b6bee7f0b",
    "id": null,
    "metadata": {},
    "name": "SpanToDatasetExampleDialogQuery",
    "operationKind": "query",
    "text": "query SpanToDatasetExampleDialogQuery(\n  $spanId: GlobalID!\n) {\n  span: node(id: $spanId) {\n    __typename\n    ... on Span {\n      revision: asExampleRevision {\n        input\n        output\n        metadata\n      }\n    }\n    __isNode: __typename\n    id\n  }\n  ...DatasetPicker__datasets\n}\n\nfragment DatasetPicker__datasets on Query {\n  datasets {\n    edges {\n      dataset: node {\n        id\n        name\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "5afd1a4eede339492f5473ed17b770b3";

export default node;
