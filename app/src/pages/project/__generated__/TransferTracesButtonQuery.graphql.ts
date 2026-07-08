/**
 * @generated SignedSource<<04dd6027a7dbd95fe1137eeb4ce77ec2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TransferTracesButtonQuery$variables = Record<PropertyKey, never>;
export type TransferTracesButtonQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"TransferTracesButton_projects">;
};
export type TransferTracesButtonQuery = {
  response: TransferTracesButtonQuery$data;
  variables: TransferTracesButtonQuery$variables;
};

const node: ConcreteRequest = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "TransferTracesButtonQuery",
    "selections": [
      {
        "args": [
          {
            "kind": "Literal",
            "name": "search",
            "value": ""
          }
        ],
        "kind": "FragmentSpread",
        "name": "TransferTracesButton_projects"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "TransferTracesButtonQuery",
    "selections": [
      {
        "alias": null,
        "args": [
          {
            "fields": [
              {
                "kind": "Literal",
                "name": "col",
                "value": "name"
              },
              {
                "kind": "Literal",
                "name": "value",
                "value": ""
              }
            ],
            "kind": "ObjectValue",
            "name": "filter"
          }
        ],
        "concreteType": "ProjectConnection",
        "kind": "LinkedField",
        "name": "projects",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "ProjectEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Project",
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
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": "projects(filter:{\"col\":\"name\",\"value\":\"\"})"
      }
    ]
  },
  "params": {
    "cacheID": "69ed32ad09cd0c5b2dacbd308cd825a6",
    "id": null,
    "metadata": {},
    "name": "TransferTracesButtonQuery",
    "operationKind": "query",
    "text": "query TransferTracesButtonQuery {\n  ...TransferTracesButton_projects_1oCkZB\n}\n\nfragment TransferTracesButton_projects_1oCkZB on Query {\n  projects(filter: {col: name, value: \"\"}) {\n    edges {\n      node {\n        id\n        name\n      }\n    }\n  }\n}\n"
  }
};

(node as any).hash = "f0df0f5854d02d94e6acd211de27eb6a";

export default node;
