import React from "react";
import { Navbar, Brand } from "./components/nav";
import { Home } from "./pages";

export function App() {
    return (
        <div>
            <Navbar>
                <Brand />
            </Navbar>
            <Home />
        </div>
    );
}
