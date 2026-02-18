import ReactDom from "react-dom/client";

import { App } from "./App";

/**
 * This is needed to support modulepreload in Vite when using a non HTML custom entrypoint (i.e., this file).
 * We do this because our index.html is served by the Phoenix server
 * @see https://vitejs.dev/config/build-options#build-modulepreload
 */
import "vite/modulepreload-polyfill";
import "normalize.css";

const rootEl = document.getElementById("root");

const root = ReactDom.createRoot(rootEl!);

root.render(<App />);
