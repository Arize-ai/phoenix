/**
 * @generated SignedSource<<0bfb82c665cd29f953eb6768c3ddcda4>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ConnectedDetailPanelAnnotationBarAddConfigToProjectMutation$variables = {
  configId: string;
  projectId: string;
};
export type ConnectedDetailPanelAnnotationBarAddConfigToProjectMutation$data = {
  readonly addAnnotationConfigToProject: {
    readonly query: {
      readonly __typename: "Query";
    };
  };
};
export type ConnectedDetailPanelAnnotationBarAddConfigToProjectMutation = {
  response: ConnectedDetailPanelAnnotationBarAddConfigToProjectMutation$data;
  variables: ConnectedDetailPanelAnnotationBarAddConfigToProjectMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "configId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "fields": [
          {
            "kind": "Variable",
            "name": "annotationConfigId",
            "variableName": "configId"
          },
          {
            "kind": "Variable",
            "name": "projectId",
            "variableName": "projectId"
          }
        ],
        "kind": "ObjectValue",
        "name": "input"
      }
    ],
    "concreteType": "AddAnnotationConfigToProjectPayload",
    "kind": "LinkedField",
    "name": "addAnnotationConfigToProject",
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
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ConnectedDetailPanelAnnotationBarAddConfigToProjectMutation",
    "selections": (v2/*:: as any*/),
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
    "name": "ConnectedDetailPanelAnnotationBarAddConfigToProjectMutation",
    "selections": (v2/*:: as any*/)
  },
  "params": {
    "cacheID": "5450c51b4e068bff958244b92eaef20b",
    "id": null,
    "metadata": {},
    "name": "ConnectedDetailPanelAnnotationBarAddConfigToProjectMutation",
    "operationKind": "mutation",
    "text": "mutation ConnectedDetailPanelAnnotationBarAddConfigToProjectMutation(\n  $projectId: ID!\n  $configId: ID!\n) {\n  addAnnotationConfigToProject(input: {projectId: $projectId, annotationConfigId: $configId}) {\n    query {\n      __typename\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "58599f5b0e7441a8373dd36143d96d0d";

export default node;
