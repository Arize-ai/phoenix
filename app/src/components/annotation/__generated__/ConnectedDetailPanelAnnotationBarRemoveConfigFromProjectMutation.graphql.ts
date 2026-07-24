/**
 * @generated SignedSource<<5686f0064f3ba4f7db809333d1e318be>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ConnectedDetailPanelAnnotationBarRemoveConfigFromProjectMutation$variables = {
  configId: string;
  projectId: string;
};
export type ConnectedDetailPanelAnnotationBarRemoveConfigFromProjectMutation$data = {
  readonly removeAnnotationConfigFromProject: {
    readonly query: {
      readonly __typename: "Query";
    };
  };
};
export type ConnectedDetailPanelAnnotationBarRemoveConfigFromProjectMutation = {
  response: ConnectedDetailPanelAnnotationBarRemoveConfigFromProjectMutation$data;
  variables: ConnectedDetailPanelAnnotationBarRemoveConfigFromProjectMutation$variables;
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
    "concreteType": "RemoveAnnotationConfigFromProjectPayload",
    "kind": "LinkedField",
    "name": "removeAnnotationConfigFromProject",
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
    "name": "ConnectedDetailPanelAnnotationBarRemoveConfigFromProjectMutation",
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
    "name": "ConnectedDetailPanelAnnotationBarRemoveConfigFromProjectMutation",
    "selections": (v2/*:: as any*/)
  },
  "params": {
    "cacheID": "f39dafcee47029a435117f0422d59216",
    "id": null,
    "metadata": {},
    "name": "ConnectedDetailPanelAnnotationBarRemoveConfigFromProjectMutation",
    "operationKind": "mutation",
    "text": "mutation ConnectedDetailPanelAnnotationBarRemoveConfigFromProjectMutation(\n  $projectId: ID!\n  $configId: ID!\n) {\n  removeAnnotationConfigFromProject(input: {projectId: $projectId, annotationConfigId: $configId}) {\n    query {\n      __typename\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "2d83ffb764dfe461d713ee4ab989d7ac";

export default node;
