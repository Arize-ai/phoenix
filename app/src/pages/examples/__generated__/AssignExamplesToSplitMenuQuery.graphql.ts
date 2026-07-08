/**
 * @generated SignedSource<<4e63577141f961e15e9190402073be0a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AssignExamplesToSplitMenuQuery$variables = Record<PropertyKey, never>;
export type AssignExamplesToSplitMenuQuery$data = {
  readonly datasetSplits: {
    readonly edges: ReadonlyArray<{
      readonly split: {
        readonly color: string;
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
};
export type AssignExamplesToSplitMenuQuery = {
  response: AssignExamplesToSplitMenuQuery$data;
  variables: AssignExamplesToSplitMenuQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "DatasetSplitConnection",
    "kind": "LinkedField",
    "name": "datasetSplits",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DatasetSplitEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": "split",
            "args": null,
            "concreteType": "DatasetSplit",
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
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
                "name": "name",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "color",
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
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "AssignExamplesToSplitMenuQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "AssignExamplesToSplitMenuQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "9f574209d5d5f8dcfaa162214cf54512",
    "id": null,
    "metadata": {},
    "name": "AssignExamplesToSplitMenuQuery",
    "operationKind": "query",
    "text": "query AssignExamplesToSplitMenuQuery {\n  datasetSplits {\n    edges {\n      split: node {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "1360d5fec214eb65a18b4f340cadf82a";

export default node;
