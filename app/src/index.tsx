import ReactDom from "react-dom/client";
import { AppRoot } from "./App";

const rootEl = document.getElementById("root");

const root = ReactDom.createRoot(rootEl!);

root.render(<AppRoot />);
