import { Provider } from "@arizeai/components";
import React from "react";
import ReactDom from "react-dom/client";
import { UMAPWidget, UMAPWidgetProps } from "./components/widgets";

declare global {
    interface Window {
        renderUMAPWidget: (data: UMAPWidgetProps) => void;
    }
}

/**
 * Global export of rendering widgets for use in notebooks
 */
window.renderUMAPWidget = function (data: UMAPWidgetProps) {
    const rootEl = document.getElementById("root");
    const root = ReactDom.createRoot(rootEl!);
    root.render(
        <Provider>
            <UMAPWidget {...data} />
        </Provider>
    );
};
