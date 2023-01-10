/*
 *                    Copyright 2023 Arize AI and contributors.
 *                     Licensed under the Elastic License 2.0;
 *   you may not use this file except in compliance with the Elastic License 2.0.
 */

import React from "react";
import ReactDom from "react-dom/client";
import { AppRoot } from "./App";

const rootEl = document.getElementById("root");

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const root = ReactDom.createRoot(rootEl!);

root.render(<AppRoot />);
