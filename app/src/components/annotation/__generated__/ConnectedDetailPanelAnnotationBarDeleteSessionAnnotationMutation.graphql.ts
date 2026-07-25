/**
 * @generated SignedSource<<4142b41b515eb78451a7baeba9354b2e>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ConnectedDetailPanelAnnotationBarDeleteSessionAnnotationMutation$variables = {
  annotationId: string;
};
export type ConnectedDetailPanelAnnotationBarDeleteSessionAnnotationMutation$data = {
  readonly deleteProjectSessionAnnotation: {
    readonly query: {
      readonly __typename: "Query";
    };
  };
};
export type ConnectedDetailPanelAnnotationBarDeleteSessionAnnotationMutation = {
  response: ConnectedDetailPanelAnnotationBarDeleteSessionAnnotationMutation$data;
  variables: ConnectedDetailPanelAnnotationBarDeleteSessionAnnotationMutation$variables;
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
        "kind": "Variable",
        "name": "id",
        "variableName": "annotationId"
      }
    ],
    "concreteType": "ProjectSessionAnnotationMutationPayload",
    "kind": "LinkedField",
    "name": "deleteProjectSessionAnnotation",
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
    "name": "ConnectedDetailPanelAnnotationBarDeleteSessionAnnotationMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ConnectedDetailPanelAnnotationBarDeleteSessionAnnotationMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "83035fefdc904232aae6d7e70f6a859f",
    "id": null,
    "metadata": {},
    "name": "ConnectedDetailPanelAnnotationBarDeleteSessionAnnotationMutation",
    "operationKind": "mutation",
    "text": "mutation ConnectedDetailPanelAnnotationBarDeleteSessionAnnotationMutation(\n  $annotationId: ID!\n) {\n  deleteProjectSessionAnnotation(id: $annotationId) {\n    query {\n      __typename\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "f58213d91a14bc36078762950dbd6cb5";

export default node;
