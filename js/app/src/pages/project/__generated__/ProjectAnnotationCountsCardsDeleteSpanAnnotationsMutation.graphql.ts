/**
 * @generated SignedSource<<4ad3afe51e1c8d9c2f8972619ad24e5b>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AnnotationTimeRangeField = "ANNOTATION_CREATED_AT" | "SOURCE_START_TIME";
export type DeleteProjectAnnotationsInput = {
  annotationName: string;
  projectId: string;
  timeRange?: TimeRange | null;
  timeRangeField?: AnnotationTimeRangeField;
};
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type ProjectAnnotationCountsCardsDeleteSpanAnnotationsMutation$variables = {
  input: DeleteProjectAnnotationsInput;
  projectId: string;
};
export type ProjectAnnotationCountsCardsDeleteSpanAnnotationsMutation$data = {
  readonly deleteProjectSpanAnnotations: {
    readonly deletedAnnotationCount: number;
    readonly query: {
      readonly node: {
        readonly spanAnnotationNameCounts?: ReadonlyArray<{
          readonly count: number;
          readonly name: string;
        }>;
      };
    };
  };
};
export type ProjectAnnotationCountsCardsDeleteSpanAnnotationsMutation = {
  response: ProjectAnnotationCountsCardsDeleteSpanAnnotationsMutation$data;
  variables: ProjectAnnotationCountsCardsDeleteSpanAnnotationsMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "input"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "deletedAnnotationCount",
  "storageKey": null
},
v4 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v5 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "AnnotationNameCount",
      "kind": "LinkedField",
      "name": "spanAnnotationNameCounts",
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
          "name": "count",
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
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectAnnotationCountsCardsDeleteSpanAnnotationsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "DeleteProjectAnnotationsByNamePayload",
        "kind": "LinkedField",
        "name": "deleteProjectSpanAnnotations",
        "plural": false,
        "selections": [
          (v3/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": (v4/*:: as any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v5/*:: as any*/)
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
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "ProjectAnnotationCountsCardsDeleteSpanAnnotationsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "DeleteProjectAnnotationsByNamePayload",
        "kind": "LinkedField",
        "name": "deleteProjectSpanAnnotations",
        "plural": false,
        "selections": [
          (v3/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": (v4/*:: as any*/),
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
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "id",
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
    "cacheID": "bed431a1f79658440ba9f39699be0bfc",
    "id": null,
    "metadata": {},
    "name": "ProjectAnnotationCountsCardsDeleteSpanAnnotationsMutation",
    "operationKind": "mutation",
    "text": "mutation ProjectAnnotationCountsCardsDeleteSpanAnnotationsMutation(\n  $projectId: ID!\n  $input: DeleteProjectAnnotationsInput!\n) {\n  deleteProjectSpanAnnotations(input: $input) {\n    deletedAnnotationCount\n    query {\n      node(id: $projectId) {\n        __typename\n        ... on Project {\n          spanAnnotationNameCounts {\n            name\n            count\n          }\n        }\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "7cd9c4dd5b59090cd32eebc658baf636";

export default node;
