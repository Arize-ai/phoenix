/**
 * @generated SignedSource<<4aac4a2bfb3450bde9fda096afce484c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment, RefetchableFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DatasetPageExamplesFragment$data = {
  readonly examples: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly id: string;
        readonly input: any;
        readonly metadata: any;
        readonly output: any;
      };
    }>;
  };
  readonly id: string;
  readonly " $fragmentType": "DatasetPageExamplesFragment";
};
export type DatasetPageExamplesFragment$key = {
  readonly " $data"?: DatasetPageExamplesFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"DatasetPageExamplesFragment">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [
        "node"
      ],
      "operation": require('./DatasetPageExamplesQuery.graphql'),
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "DatasetPageExamplesFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "DatasetExampleConnection",
      "kind": "LinkedField",
      "name": "examples",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "DatasetExampleEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "DatasetExample",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v0/*: any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "input",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "output",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "metadata",
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
    },
    (v0/*: any*/)
  ],
  "type": "Dataset",
  "abstractKey": null
};
})();

(node as any).hash = "1212808418be6d86daf5649c4bb71163";

export default node;
