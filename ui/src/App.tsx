import React from "react";
import ReactDom from "react-dom/client";

let Greet = () => <h1>Hello, world!</h1>;

const root = ReactDom.createRoot(document.getElementById("root"));
root.render(<Greet />);
