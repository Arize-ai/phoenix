/**
 * @generated SignedSource<<34c6e56614009040cc332bb1bb63112f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ConnectedDetailPanelAnnotationBarDeleteSpanAnnotationMutation$variables = {
  annotationId: string;
};
export type ConnectedDetailPanelAnnotationBarDeleteSpanAnnotationMutation$data = {
  readonly deleteSpanAnnotations: {
    readonly query: {
      readonly __typename: "Query";
    };
  };
};
export type ConnectedDetailPanelAnnotationBarDeleteSpanAnnotationMutation = {
  response: ConnectedDetailPanelAnnotationBarDeleteSpanAnnotationMutation$data;
  variables: ConnectedDetailPanelAnnotationBarDeleteSpanAnnotationMutation$variables;
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
        "concreteType": "Query",
        "kind": "LinkedField",
        "name": "query",
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
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ConnectedDetailPanelAnnotationBarDeleteSpanAnnotationMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ConnectedDetailPanelAnnotationBarDeleteSpanAnnotationMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "061fd13b97bfbcdfacf02ce6a9e21874",
    "id": null,
    "metadata": {},
    "name": "ConnectedDetailPanelAnnotationBarDeleteSpanAnnotationMutation",
    "operationKind": "mutation",
    "text": "mutation ConnectedDetailPanelAnnotationBarDeleteSpanAnnotationMutation(\n  $annotationId: ID!\n) {\n  deleteSpanAnnotations(input: {annotationIds: [$annotationId]}) {\n    query {\n      __typename\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "bc14dfbecf3284e93b41ad00ae7d46ce";

export default node;
