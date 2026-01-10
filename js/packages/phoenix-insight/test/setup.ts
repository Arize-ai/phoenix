import { vi, beforeEach, afterEach } from "vitest";

// Mock @arizeai/phoenix-client globally to ensure no real network calls
vi.mock("@arizeai/phoenix-client", () => ({
  createClient: vi.fn(),
}));

// Clean up mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Note: Console methods are not mocked globally to allow tests to verify console output.
// Individual tests can mock console methods if needed to suppress output.
