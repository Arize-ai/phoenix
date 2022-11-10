import React from "react";
import ReactDom from "react-dom/client";

declare global {
    interface Window {
        renderWidget: () => void;
    }
}

let Greet = () => <h1>Hello, world from React</h1>;

const root = ReactDom.createRoot(document.getElementById("root"));

window.renderWidget = function () {
    root.render(<Greet />);
};
