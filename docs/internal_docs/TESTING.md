# Testing

## Why you should care

Hot take: your software source code is not the asset that you might think it is. It is a liability. More code means more liability.

“Technical debt” is not like a loan. Loans have known repayment schedules and amounts. Bugs arise from code at unknown times with unknown quantities of effort that must be paid to correct them. This is not like a loan. “Tech debt” is a misnomer - it is actually an un-hedged call option, a kind of contingent liability that must be paid at an unknown time at an unbounded cost.

In the world of software, the goal is working features, not lines of source code. Working tests that prove the continued existence of those features behave like assets. Code that produces those features is a liability.

Reduce your risk; balance code with tests.

## Testing Classifications

Testing can be classified into 4 types

-   End to End: A helper robot that behaves like a user to click around the app and verify that it functions correctly. Sometimes called "functional testing" or e2e.
-   Integration: Verify that several units work together in harmony.
-   Unit: Verify that individual, isolated parts work as expected.
-   Static: Catch typos and type errors as you write the code.

We cover these 4 types of tests

-   End to end: Playwright
-   Integration: pytest + DB
-   Unit: pytest, Vitest
-   Static: mypy, TypeScript

## Integration Testing

> [Write tests, Not too many. Mostly integration](https://kentcdodds.com/blog/write-tests)

We spin up the `phoenix server` with both `sqlite` and `postgres` for our integration tests. These tests are written in python.

### Why IT?

-   Testing service boundaries (`server` to `database`, `server` to `smtp` etc.)
-   RBAC sanity checks
-   Ensure the server can boot in different environments


## End to End Testing

We write end to end tests using [Playwright](https://playwright.dev/), a browser automation library that allows you to write tests that interact with your web application in a browser.

### Why E2E Testing?

The most important thing about E2E tests is that they are the closest thing to a real user. They are the most likely to catch bugs that unit tests and integration tests might miss.

-   Browser testing ensures the product is usable as intended (flows, a11y)
-   Regression testing (ensure existing functionality works and stays working)
-   [future] visual regression testing

### E2E Testing Best Practices

-   Use stable selectors (human readable text or `data-testid`) See [Making tests resilient to change (data-testid)](https://kentcdodds.com/blog/making-your-ui-tests-resilient-to-change)
-   Avoid explicit timers. The tests should try to emulate a real user. You should try to wait for elements to show or for network calls to complete
-   Don't hard code `environment` specifics in the tests (strings and IDs).


## Resources

-   [Code is not an asset](https://robinbb.com/blog/code-is-not-an-asset/)
-   [Testing trophy and testing classifications](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
-   [Making tests resilient to change (data-testid)](https://kentcdodds.com/blog/making-your-ui-tests-resilient-to-change)
