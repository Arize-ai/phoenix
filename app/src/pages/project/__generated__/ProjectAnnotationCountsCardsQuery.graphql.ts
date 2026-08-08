/**
 * @generated SignedSource<<d2e737f139a94548f47a63a76a6bb247>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ProjectAnnotationCountsCardsQuery$variables = {
  projectId: string;
};
export type ProjectAnnotationCountsCardsQuery$data = {
  readonly project: {
    readonly sessionAnnotationNameCounts?: ReadonlyArray<{
      readonly count: number;
      readonly name: string;
    }>;
    readonly spanAnnotationNameCounts?: ReadonlyArray<{
      readonly count: number;
      readonly name: string;
    }>;
    readonly traceAnnotationNameCounts?: ReadonlyArray<{
      readonly count: number;
      readonly name: string;
    }>;
  };
};
export type ProjectAnnotationCountsCardsQuery = {
  response: ProjectAnnotationCountsCardsQuery$data;
  variables: ProjectAnnotationCountsCardsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "projectId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v2 = [
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
    "name": "count",
    "storageKey": null
  }
],
v3 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "AnnotationNameCount",
      "kind": "LinkedField",
      "name": "spanAnnotationNameCounts",
      "plural": true,
      "selections": (v2/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "AnnotationNameCount",
      "kind": "LinkedField",
      "name": "traceAnnotationNameCounts",
      "plural": true,
      "selections": (v2/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "AnnotationNameCount",
      "kind": "LinkedField",
      "name": "sessionAnnotationNameCounts",
      "plural": true,
      "selections": (v2/*:: as any*/),
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
    "name": "ProjectAnnotationCountsCardsQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*:: as any*/),
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ProjectAnnotationCountsCardsQuery",
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
    "cacheID": "3a70bed7f41655566844d28d6f34b95f",
    "id": null,
    "metadata": {},
    "name": "ProjectAnnotationCountsCardsQuery",
    "operationKind": "query",
    "text": "query ProjectAnnotationCountsCardsQuery(\n  $projectId: ID!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      spanAnnotationNameCounts {\n        name\n        count\n      }\n      traceAnnotationNameCounts {\n        name\n        count\n      }\n      sessionAnnotationNameCounts {\n        name\n        count\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "9fa3baf2b92b1df542a34d067ca19878";

export default node;
