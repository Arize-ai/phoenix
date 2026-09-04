/**
 * @generated SignedSource<<2b8bcb6d386c72485f0a776497de5397>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type TraceFilterConditionFieldVocabularyQuery$variables = {
  id: string;
};
export type TraceFilterConditionFieldVocabularyQuery$data = {
  readonly project: {
    readonly traceFilterVocabulary?: ReadonlyArray<{
      readonly category: string;
      readonly description: string;
      readonly iterableName: string | null;
      readonly name: string;
      readonly type: string;
    }>;
  };
};
export type TraceFilterConditionFieldVocabularyQuery = {
  response: TraceFilterConditionFieldVocabularyQuery$data;
  variables: TraceFilterConditionFieldVocabularyQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "FilterVocabularyTerm",
      "kind": "LinkedField",
      "name": "traceFilterVocabulary",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "name",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "type",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "description",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "category",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "iterableName",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "TraceFilterConditionFieldVocabularyQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "TraceFilterConditionFieldVocabularyQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*:: as any*/),
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
          (v2/*:: as any*/),
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
    "cacheID": "4d3fca62e83f4e5e235afb0fe8ae29ae",
    "id": null,
    "metadata": {},
    "name": "TraceFilterConditionFieldVocabularyQuery",
    "operationKind": "query",
    "text": "query TraceFilterConditionFieldVocabularyQuery(\n  $id: ID!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      traceFilterVocabulary {\n        name\n        type\n        description\n        category\n        iterableName\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "1a1da4965b0b6b8c1c1a9eaea6ce58e0";

export default node;
