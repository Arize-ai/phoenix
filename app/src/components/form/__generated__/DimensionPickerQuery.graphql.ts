/**
 * @generated SignedSource<<606285a493f8754bd9bd14cbf56a51a5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type DimensionDataType = "categorical" | "numeric";
export type DimensionType = "actual" | "feature" | "prediction" | "tag";
export type DimensionPickerQuery$variables = {};
export type DimensionPickerQuery$data = {
  readonly model: {
    readonly dimensions: {
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly dataType: DimensionDataType;
          readonly id: string;
          readonly name: string;
          readonly type: DimensionType;
        };
      }>;
    };
  };
};
export type DimensionPickerQuery = {
  response: DimensionPickerQuery$data;
  variables: DimensionPickerQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "Model",
    "kind": "LinkedField",
    "name": "model",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DimensionConnection",
        "kind": "LinkedField",
        "name": "dimensions",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DimensionEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Dimension",
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
                    "name": "type",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "dataType",
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
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "DimensionPickerQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "DimensionPickerQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "56e356d226d322dabfd9db8010884e4f",
    "id": null,
    "metadata": {},
    "name": "DimensionPickerQuery",
    "operationKind": "query",
    "text": "query DimensionPickerQuery {\n  model {\n    dimensions {\n      edges {\n        node {\n          id\n          name\n          type\n          dataType\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "747256fac1de97803ae6f96e3cb58d98";

export default node;
