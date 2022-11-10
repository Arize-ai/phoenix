import React from "react";
import ReactDom from "react-dom/client";

declare global {
    interface Window {
        renderWidget: () => void;
    }
}

let Greet = () => <h1>Hello, world from React</h1>;
const rootEl = document.getElementById("root");

const root = ReactDom.createRoot(rootEl!);

/**
 * Global export of rendering widgets for use in notebooks
 */
window.renderWidget = function () {
    root.render(<Greet />);
};
