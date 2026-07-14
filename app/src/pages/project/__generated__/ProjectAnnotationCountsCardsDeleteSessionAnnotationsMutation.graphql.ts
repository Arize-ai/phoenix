/**
 * @generated SignedSource<<f7094fd00e1e2f011d7023fdd6c328fc>>
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
export type ProjectAnnotationCountsCardsDeleteSessionAnnotationsMutation$variables = {
  input: DeleteProjectAnnotationsInput;
  projectId: string;
};
export type ProjectAnnotationCountsCardsDeleteSessionAnnotationsMutation$data = {
  readonly deleteProjectSessionAnnotations: {
    readonly deletedAnnotationCount: number;
    readonly query: {
      readonly node: {
        readonly sessionAnnotationNameCounts?: ReadonlyArray<{
          readonly count: number;
          readonly name: string;
        }>;
      };
    };
  };
};
export type ProjectAnnotationCountsCardsDeleteSessionAnnotationsMutation = {
  response: ProjectAnnotationCountsCardsDeleteSessionAnnotationsMutation$data;
  variables: ProjectAnnotationCountsCardsDeleteSessionAnnotationsMutation$variables;
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
      "name": "sessionAnnotationNameCounts",
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
    "name": "ProjectAnnotationCountsCardsDeleteSessionAnnotationsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "DeleteProjectAnnotationsByNamePayload",
        "kind": "LinkedField",
        "name": "deleteProjectSessionAnnotations",
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
    "name": "ProjectAnnotationCountsCardsDeleteSessionAnnotationsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "DeleteProjectAnnotationsByNamePayload",
        "kind": "LinkedField",
        "name": "deleteProjectSessionAnnotations",
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
    "cacheID": "863af3fac614415e167fb20e7357a218",
    "id": null,
    "metadata": {},
    "name": "ProjectAnnotationCountsCardsDeleteSessionAnnotationsMutation",
    "operationKind": "mutation",
    "text": "mutation ProjectAnnotationCountsCardsDeleteSessionAnnotationsMutation(\n  $projectId: ID!\n  $input: DeleteProjectAnnotationsInput!\n) {\n  deleteProjectSessionAnnotations(input: $input) {\n    deletedAnnotationCount\n    query {\n      node(id: $projectId) {\n        __typename\n        ... on Project {\n          sessionAnnotationNameCounts {\n            name\n            count\n          }\n        }\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "00e0503793845c41ae79e2a8a1667f0b";

export default node;
