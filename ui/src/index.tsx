import React from "react";
import ReactDom from "react-dom/client";
import { PointCloud } from "./components/PointCloud";

declare global {
    interface Window {
        renderWidget: () => void;
    }
}

/**
 * Global export of rendering widgets for use in notebooks
 */
window.renderWidget = function () {
    const rootEl = document.getElementById("root");
    const root = ReactDom.createRoot(rootEl!);
    root.render(<PointCloud />);
};
