/**
 * @generated SignedSource<<34fee6eb935464d0310dede31ae7e267>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type TraceFilterConditionFieldVocabularyQuery$variables = {
  id: string;
  timeRange: TimeRange;
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
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "timeRange"
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
      "args": [
        {
          "kind": "Variable",
          "name": "timeRange",
          "variableName": "timeRange"
        }
      ],
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
    "cacheID": "b1e3f47ec1c8ff023e1e6e8bcbcf71cb",
    "id": null,
    "metadata": {},
    "name": "TraceFilterConditionFieldVocabularyQuery",
    "operationKind": "query",
    "text": "query TraceFilterConditionFieldVocabularyQuery(\n  $id: ID!\n  $timeRange: TimeRange!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      traceFilterVocabulary(timeRange: $timeRange) {\n        name\n        type\n        description\n        category\n        iterableName\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "83c927b26c0fe3d7c175189a8df05f5f";

export default node;
