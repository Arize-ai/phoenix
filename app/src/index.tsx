import React from "react";
// Rest of your app code
import ReactDom from "react-dom/client";

import "vite/modulepreload-polyfill";

import App from "./App";

import "normalize.css";

const rootEl = document.getElementById("root");

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const root = ReactDom.createRoot(rootEl!);

root.render(<App />);
