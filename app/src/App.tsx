import { Navbar, Brand } from "./components/nav";
import { Home } from "./pages";
import { Provider, theme } from "@arizeai/components";
import React, { Suspense } from "react";
import ReactDom from "react-dom/client";
import { GlobalStyles } from "./GlobalStyles";
import { ThemeProvider } from "@emotion/react";
import { RelayEnvironmentProvider, graphql, loadQuery } from "react-relay";
import RelayEnvironment from "./RelayEnvironment";

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

// Define a query
const RootQuery = graphql`
    query AppRootQuery {
        primaryDataset {
            name
        }
        referenceDataset {
            name
        }
    }
`;

export function AppRoot() {
    const preloadedQuery = loadQuery(RelayEnvironment, RootQuery, {});
    return (
        <Provider>
            <ThemeProvider theme={theme}>
                <RelayEnvironmentProvider environment={RelayEnvironment}>
                    <GlobalStyles />
                    <Suspense fallback={"Loading..."}>
                        <App />
                    </Suspense>
                </RelayEnvironmentProvider>
            </ThemeProvider>
        </Provider>
    );
}
