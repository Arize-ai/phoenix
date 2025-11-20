/**
 * @generated SignedSource<<12dffaec02e562ca219627412404a1e5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type AddEvaluatorMenu_query$data = {
  readonly dataset: {
    readonly " $fragmentSpreads": FragmentRefs<"EvaluatorConfigDialog_dataset">;
  };
  readonly " $fragmentSpreads": FragmentRefs<"AddEvaluatorMenu_codeEvaluatorTemplates">;
  readonly " $fragmentType": "AddEvaluatorMenu_query";
};
export type AddEvaluatorMenu_query$key = {
  readonly " $data"?: AddEvaluatorMenu_query$data;
  readonly " $fragmentSpreads": FragmentRefs<"AddEvaluatorMenu_query">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "datasetId"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "AddEvaluatorMenu_query",
  "selections": [
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "AddEvaluatorMenu_codeEvaluatorTemplates"
    },
    {
      "alias": "dataset",
      "args": [
        {
          "kind": "Variable",
          "name": "id",
          "variableName": "datasetId"
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
              "args": null,
              "kind": "FragmentSpread",
              "name": "EvaluatorConfigDialog_dataset"
            }
          ],
          "type": "Dataset",
          "abstractKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "b0b3693e930c9de36cfc141dd6035dca";

export default node;
