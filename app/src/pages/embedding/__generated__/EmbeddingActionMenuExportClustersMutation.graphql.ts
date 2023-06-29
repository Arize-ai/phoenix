/**
 * @generated SignedSource<<f4cb99918ca2e3b7c9b4640637646016>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
export type ClusterInput = {
  eventIds: ReadonlyArray<string>;
  id?: string | null;
};
export type EmbeddingActionMenuExportClustersMutation$variables = {
  clusters: ReadonlyArray<ClusterInput>;
};
export type EmbeddingActionMenuExportClustersMutation$data = {
  readonly exportClusters: {
    readonly fileName: string;
  };
};
export type EmbeddingActionMenuExportClustersMutation = {
  response: EmbeddingActionMenuExportClustersMutation$data;
  variables: EmbeddingActionMenuExportClustersMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "clusters"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "clusters",
        "variableName": "clusters"
      }
    ],
    "concreteType": "ExportedFile",
    "kind": "LinkedField",
    "name": "exportClusters",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "fileName",
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
    "name": "EmbeddingActionMenuExportClustersMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "EmbeddingActionMenuExportClustersMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "1bef6586fcb3d6eb7034204fbe49633c",
    "id": null,
    "metadata": {},
    "name": "EmbeddingActionMenuExportClustersMutation",
    "operationKind": "mutation",
    "text": "mutation EmbeddingActionMenuExportClustersMutation(\n  $clusters: [ClusterInput!]!\n) {\n  exportClusters(clusters: $clusters) {\n    fileName\n  }\n}\n"
  }
};
})();

(node as any).hash = "b5ff2517dbb0d19a1b24dea1796a3576";

export default node;
