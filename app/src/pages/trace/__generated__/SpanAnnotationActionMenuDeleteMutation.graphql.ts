/**
 * @generated SignedSource<<603156bd64d9bf9bdc5d25052634c9ae>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
export type SpanAnnotationActionMenuDeleteMutation$variables = {
  annotationId: string;
};
export type SpanAnnotationActionMenuDeleteMutation$data = {
  readonly deleteSpanAnnotations: {
    readonly __typename: "SpanAnnotationMutationPayload";
  };
};
export type SpanAnnotationActionMenuDeleteMutation = {
  response: SpanAnnotationActionMenuDeleteMutation$data;
  variables: SpanAnnotationActionMenuDeleteMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "annotationId"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "fields": [
          {
            "items": [
              {
                "kind": "Variable",
                "name": "annotationIds.0",
                "variableName": "annotationId"
              }
            ],
            "kind": "ListValue",
            "name": "annotationIds"
          }
        ],
        "kind": "ObjectValue",
        "name": "input"
      }
    ],
    "concreteType": "SpanAnnotationMutationPayload",
    "kind": "LinkedField",
    "name": "deleteSpanAnnotations",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "__typename",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SpanAnnotationActionMenuDeleteMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SpanAnnotationActionMenuDeleteMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "6745f5629565f1a550bcc4cf6514b795",
    "id": null,
    "metadata": {},
    "name": "SpanAnnotationActionMenuDeleteMutation",
    "operationKind": "mutation",
    "text": "mutation SpanAnnotationActionMenuDeleteMutation(\n  $annotationId: GlobalID!\n) {\n  deleteSpanAnnotations(input: {annotationIds: [$annotationId]}) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "911d3053fb16cfc65512f83b0d428772";

export default node;
