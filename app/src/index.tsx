import { Provider } from "@arizeai/components";
import { App } from "./App";
import React from "react";
import ReactDom from "react-dom/client";

const rootEl = document.getElementById("root");
debugger;
const root = ReactDom.createRoot(rootEl!);
root.render(
    <Provider>
        <App />
    </Provider>
);
