/**
 * @generated SignedSource<<91c2fc7d65f33a2fd7e94bd1d6965599>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ConnectedDetailPanelAnnotationBarDeleteTraceAnnotationMutation$variables = {
  annotationId: string;
};
export type ConnectedDetailPanelAnnotationBarDeleteTraceAnnotationMutation$data = {
  readonly deleteTraceAnnotations: {
    readonly query: {
      readonly __typename: "Query";
    };
  };
};
export type ConnectedDetailPanelAnnotationBarDeleteTraceAnnotationMutation = {
  response: ConnectedDetailPanelAnnotationBarDeleteTraceAnnotationMutation$data;
  variables: ConnectedDetailPanelAnnotationBarDeleteTraceAnnotationMutation$variables;
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
    "concreteType": "TraceAnnotationMutationPayload",
    "kind": "LinkedField",
    "name": "deleteTraceAnnotations",
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
    "name": "ConnectedDetailPanelAnnotationBarDeleteTraceAnnotationMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ConnectedDetailPanelAnnotationBarDeleteTraceAnnotationMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "2088ef3c6fced79c0c107ad0c785e117",
    "id": null,
    "metadata": {},
    "name": "ConnectedDetailPanelAnnotationBarDeleteTraceAnnotationMutation",
    "operationKind": "mutation",
    "text": "mutation ConnectedDetailPanelAnnotationBarDeleteTraceAnnotationMutation(\n  $annotationId: ID!\n) {\n  deleteTraceAnnotations(input: {annotationIds: [$annotationId]}) {\n    query {\n      __typename\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "caf104a31b60df5240f3604fdf7930ed";

export default node;
