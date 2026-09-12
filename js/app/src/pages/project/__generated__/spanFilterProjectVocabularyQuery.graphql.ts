/**
 * @generated SignedSource<<d23e4fe9b3f3e70f8e0779156c7119d1>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type spanFilterProjectVocabularyQuery$variables = {
  id: string;
  includeModels: boolean;
  modelUsageStart: string;
};
export type spanFilterProjectVocabularyQuery$data = {
  readonly project: {
    readonly spanAnnotationNames?: ReadonlyArray<string>;
    readonly topModelsByTokenCount?: ReadonlyArray<{
      readonly name: string;
    }>;
    readonly traceAnnotationsNames?: ReadonlyArray<string>;
  };
};
export type spanFilterProjectVocabularyQuery = {
  response: spanFilterProjectVocabularyQuery$data;
  variables: spanFilterProjectVocabularyQuery$variables;
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
    "name": "includeModels"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "modelUsageStart"
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
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "spanAnnotationNames",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "traceAnnotationsNames",
  "storageKey": null
},
v4 = [
  {
    "fields": [
      {
        "kind": "Variable",
        "name": "start",
        "variableName": "modelUsageStart"
      }
    ],
    "kind": "ObjectValue",
    "name": "timeRange"
  }
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "spanFilterProjectVocabularyQuery",
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
            "kind": "InlineFragment",
            "selections": [
              (v2/*:: as any*/),
              (v3/*:: as any*/),
              {
                "condition": "includeModels",
                "kind": "Condition",
                "passingValue": true,
                "selections": [
                  {
                    "alias": null,
                    "args": (v4/*:: as any*/),
                    "concreteType": "GenerativeModel",
                    "kind": "LinkedField",
                    "name": "topModelsByTokenCount",
                    "plural": true,
                    "selections": [
                      (v5/*:: as any*/)
                    ],
                    "storageKey": null
                  }
                ]
              }
            ],
            "type": "Project",
            "abstractKey": null
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "spanFilterProjectVocabularyQuery",
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
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*:: as any*/),
              (v3/*:: as any*/),
              {
                "condition": "includeModels",
                "kind": "Condition",
                "passingValue": true,
                "selections": [
                  {
                    "alias": null,
                    "args": (v4/*:: as any*/),
                    "concreteType": "GenerativeModel",
                    "kind": "LinkedField",
                    "name": "topModelsByTokenCount",
                    "plural": true,
                    "selections": [
                      (v5/*:: as any*/),
                      (v6/*:: as any*/)
                    ],
                    "storageKey": null
                  }
                ]
              }
            ],
            "type": "Project",
            "abstractKey": null
          },
          (v6/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "22699b33a899ed1df6fe8c5aa2e42733",
    "id": null,
    "metadata": {},
    "name": "spanFilterProjectVocabularyQuery",
    "operationKind": "query",
    "text": "query spanFilterProjectVocabularyQuery(\n  $id: ID!\n  $includeModels: Boolean!\n  $modelUsageStart: DateTime!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      spanAnnotationNames\n      traceAnnotationsNames\n      topModelsByTokenCount(timeRange: {start: $modelUsageStart}) @include(if: $includeModels) {\n        name\n        id\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "921d3c3cddc661767c20fe7c4d65dd58";

export default node;
