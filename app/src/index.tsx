import { Provider, theme } from "@arizeai/components";
import { App } from "./App";
import React from "react";
import ReactDom from "react-dom/client";
import { GlobalStyles } from "./GlobalStyles";
import { ThemeProvider } from "@emotion/react";

const rootEl = document.getElementById("root");

const root = ReactDom.createRoot(rootEl!);
root.render(
    <Provider>
        <ThemeProvider theme={theme}>
            <GlobalStyles />
            <App />
        </ThemeProvider>
    </Provider>
);
