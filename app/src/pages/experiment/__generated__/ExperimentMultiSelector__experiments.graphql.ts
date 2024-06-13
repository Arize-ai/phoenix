/**
 * @generated SignedSource<<a81c0a2ee236e6086d88c36111e6e1cf>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ExperimentMultiSelector__experiments$data = {
  readonly experiments: {
    readonly edges: ReadonlyArray<{
      readonly experiment: {
        readonly createdAt: string;
        readonly description: string | null;
        readonly id: string;
        readonly sequenceNumber: number;
      };
    }>;
  };
  readonly " $fragmentType": "ExperimentMultiSelector__experiments";
};
export type ExperimentMultiSelector__experiments$key = {
  readonly " $data"?: ExperimentMultiSelector__experiments$data;
  readonly " $fragmentSpreads": FragmentRefs<"ExperimentMultiSelector__experiments">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ExperimentMultiSelector__experiments",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "ExperimentConnection",
      "kind": "LinkedField",
      "name": "experiments",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "ExperimentEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": "experiment",
              "args": null,
              "concreteType": "Experiment",
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
                  "name": "sequenceNumber",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "description",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "createdAt",
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
  "type": "Dataset",
  "abstractKey": null
};

(node as any).hash = "8794d5b225c97e3f92451bfe596190e6";

export default node;
