/**
 * @generated SignedSource<<6b7c25a275a01d4e37cf0f10ea2f6c6e>>
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
export type ProjectAnnotationCountsCardsDeleteTraceAnnotationsMutation$variables = {
  input: DeleteProjectAnnotationsInput;
  projectId: string;
};
export type ProjectAnnotationCountsCardsDeleteTraceAnnotationsMutation$data = {
  readonly deleteProjectTraceAnnotations: {
    readonly deletedAnnotationCount: number;
    readonly query: {
      readonly node: {
        readonly traceAnnotationNameCounts?: ReadonlyArray<{
          readonly count: number;
          readonly name: string;
        }>;
      };
    };
  };
};
export type ProjectAnnotationCountsCardsDeleteTraceAnnotationsMutation = {
  response: ProjectAnnotationCountsCardsDeleteTraceAnnotationsMutation$data;
  variables: ProjectAnnotationCountsCardsDeleteTraceAnnotationsMutation$variables;
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
      "name": "traceAnnotationNameCounts",
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
    "name": "ProjectAnnotationCountsCardsDeleteTraceAnnotationsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "DeleteProjectAnnotationsByNamePayload",
        "kind": "LinkedField",
        "name": "deleteProjectTraceAnnotations",
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
    "name": "ProjectAnnotationCountsCardsDeleteTraceAnnotationsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "DeleteProjectAnnotationsByNamePayload",
        "kind": "LinkedField",
        "name": "deleteProjectTraceAnnotations",
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
    "cacheID": "4e9c9bda076a765f663e8bc7aadd2aa6",
    "id": null,
    "metadata": {},
    "name": "ProjectAnnotationCountsCardsDeleteTraceAnnotationsMutation",
    "operationKind": "mutation",
    "text": "mutation ProjectAnnotationCountsCardsDeleteTraceAnnotationsMutation(\n  $projectId: ID!\n  $input: DeleteProjectAnnotationsInput!\n) {\n  deleteProjectTraceAnnotations(input: $input) {\n    deletedAnnotationCount\n    query {\n      node(id: $projectId) {\n        __typename\n        ... on Project {\n          traceAnnotationNameCounts {\n            name\n            count\n          }\n        }\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "40c81a52b1117a8f8fdac6516ab0c35c";

export default node;
