/**
 * @generated SignedSource<<52dfb333fd0b7293b4f04cd5920f1cc7>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TransferTracesButtonProjectsQuery$variables = {
  search: string;
};
export type TransferTracesButtonProjectsQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"TransferTracesButton_projects">;
};
export type TransferTracesButtonProjectsQuery = {
  response: TransferTracesButtonProjectsQuery$data;
  variables: TransferTracesButtonProjectsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "search"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "TransferTracesButtonProjectsQuery",
    "selections": [
      {
        "args": [
          {
            "kind": "Variable",
            "name": "search",
            "variableName": "search"
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "TransferTracesButtonProjectsQuery",
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
                "kind": "Variable",
                "name": "value",
                "variableName": "search"
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
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "cbe218bcb13ce57f75c3f785490e5ec4",
    "id": null,
    "metadata": {},
    "name": "TransferTracesButtonProjectsQuery",
    "operationKind": "query",
    "text": "query TransferTracesButtonProjectsQuery(\n  $search: String!\n) {\n  ...TransferTracesButton_projects_40zwac\n}\n\nfragment TransferTracesButton_projects_40zwac on Query {\n  projects(filter: {col: name, value: $search}) {\n    edges {\n      node {\n        id\n        name\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "a44c352be1e86a92920582b62ce0b767";

export default node;
