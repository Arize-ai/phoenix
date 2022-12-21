import React, { ReactNode } from "react";

export function Brand() {
    return <a href="/">Phoenix</a>;
}

export function Navbar({ children }: { children: ReactNode }) {
    return <nav>{children}</nav>;
}
