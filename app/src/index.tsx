import ReactDom from "react-dom/client";

/**
 * This is needed to support modulepreload in Vite when using a non HTML custom entrypoint (i.e., this file).
 * We do this because our index.html is served by the Phoenix server
 * @see https://vitejs.dev/config/build-options#build-modulepreload
 */
import "vite/modulepreload-polyfill";

import { App } from "./App";

import "normalize.css";

const rootEl = document.getElementById("root");

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const root = ReactDom.createRoot(rootEl!);

root.render(<App />);
