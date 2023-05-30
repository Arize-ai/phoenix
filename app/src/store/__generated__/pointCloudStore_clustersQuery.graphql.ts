/**
 * @generated SignedSource<<f6c0162ffc5ec47e2e922736c201abc1>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type InputCoordinate3D = {
  x: number;
  y: number;
  z: number;
};
export type pointCloudStore_clustersQuery$variables = {
  clusterMinSamples: number;
  clusterSelectionEpsilon: number;
  coordinates: ReadonlyArray<InputCoordinate3D>;
  eventIds: ReadonlyArray<string>;
  minClusterSize: number;
};
export type pointCloudStore_clustersQuery$data = {
  readonly hdbscanClustering: ReadonlyArray<{
    readonly driftRatio: number | null;
    readonly eventIds: ReadonlyArray<string>;
    readonly id: string;
  }>;
};
export type pointCloudStore_clustersQuery = {
  response: pointCloudStore_clustersQuery$data;
  variables: pointCloudStore_clustersQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "clusterMinSamples"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "clusterSelectionEpsilon"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "coordinates"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "eventIds"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "minClusterSize"
},
v5 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "clusterMinSamples",
        "variableName": "clusterMinSamples"
      },
      {
        "kind": "Variable",
        "name": "clusterSelectionEpsilon",
        "variableName": "clusterSelectionEpsilon"
      },
      {
        "kind": "Variable",
        "name": "coordinates3d",
        "variableName": "coordinates"
      },
      {
        "kind": "Variable",
        "name": "eventIds",
        "variableName": "eventIds"
      },
      {
        "kind": "Variable",
        "name": "minClusterSize",
        "variableName": "minClusterSize"
      }
    ],
    "concreteType": "Cluster",
    "kind": "LinkedField",
    "name": "hdbscanClustering",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "eventIds",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "driftRatio",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      (v3/*: any*/),
      (v4/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "pointCloudStore_clustersQuery",
    "selections": (v5/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v3/*: any*/),
      (v2/*: any*/),
      (v4/*: any*/),
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Operation",
    "name": "pointCloudStore_clustersQuery",
    "selections": (v5/*: any*/)
  },
  "params": {
    "cacheID": "c97c9c676a6fc05bfc0a51bef8588e13",
    "id": null,
    "metadata": {},
    "name": "pointCloudStore_clustersQuery",
    "operationKind": "query",
    "text": "query pointCloudStore_clustersQuery(\n  $eventIds: [ID!]!\n  $coordinates: [InputCoordinate3D!]!\n  $minClusterSize: Int!\n  $clusterMinSamples: Int!\n  $clusterSelectionEpsilon: Float!\n) {\n  hdbscanClustering(eventIds: $eventIds, coordinates3d: $coordinates, minClusterSize: $minClusterSize, clusterMinSamples: $clusterMinSamples, clusterSelectionEpsilon: $clusterSelectionEpsilon) {\n    id\n    eventIds\n    driftRatio\n  }\n}\n"
  }
};
})();

(node as any).hash = "65a8e6e798ce04f16ef3f611ec504360";

export default node;
