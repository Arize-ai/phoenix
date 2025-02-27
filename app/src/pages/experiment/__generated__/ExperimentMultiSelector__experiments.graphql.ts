/**
 * @generated SignedSource<<39b76fe61e1f5ab6c640e86d5426df57>>
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
        readonly id: string;
        readonly name: string;
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
                  "name": "name",
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

(node as any).hash = "1aa376b1e9425f49268ac231dc2c0412";

export default node;
