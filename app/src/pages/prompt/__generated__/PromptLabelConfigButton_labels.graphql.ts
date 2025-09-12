/**
 * @generated SignedSource<<d02ba3da3bede6010856a041e6175146>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptLabelConfigButton_labels$data = {
  readonly prompt: {
    readonly labels?: ReadonlyArray<{
      readonly id: string;
    }>;
  };
  readonly promptLabels: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly color: string;
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
  readonly " $fragmentType": "PromptLabelConfigButton_labels";
};
export type PromptLabelConfigButton_labels$key = {
  readonly " $data"?: PromptLabelConfigButton_labels$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptLabelConfigButton_labels">;
};

import PromptLabelConfigButtonLabelsQuery_graphql from './PromptLabelConfigButtonLabelsQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "promptId"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [],
      "operation": PromptLabelConfigButtonLabelsQuery_graphql
    }
  },
  "name": "PromptLabelConfigButton_labels",
  "selections": [
    {
      "alias": "prompt",
      "args": [
        {
          "kind": "Variable",
          "name": "id",
          "variableName": "promptId"
        }
      ],
      "concreteType": null,
      "kind": "LinkedField",
      "name": "node",
      "plural": false,
      "selections": [
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "PromptLabel",
              "kind": "LinkedField",
              "name": "labels",
              "plural": true,
              "selections": [
                (v0/*: any*/)
              ],
              "storageKey": null
            }
          ],
          "type": "Prompt",
          "abstractKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "PromptLabelConnection",
      "kind": "LinkedField",
      "name": "promptLabels",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "PromptLabelEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "PromptLabel",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v0/*: any*/),
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
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "fdae943ac8438a04a6bfff8eba2ce4bd";

export default node;
