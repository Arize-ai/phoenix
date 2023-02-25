import React from "react";
import ReactDom from "react-dom/client";

import { AppRoot } from "./App";

import "normalize.css";

const rootEl = document.getElementById("root");

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const root = ReactDom.createRoot(rootEl!);

root.render(<AppRoot />);
