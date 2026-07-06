import { beforeEach } from "vitest";

// Opt-in Web Storage mock for tests that mount a store backed by zustand
// `persist` (localStorage). jsdom ships a non-functional `localStorage` stub in
// this environment, so any test that reads or writes storage must import this
// and call `installTestStorage()`.
class TestStorage implements Storage {
  private readonly data = new Map<string, string>();

  get length() {
    return this.data.size;
  }

  clear() {
    this.data.clear();
  }

  getItem(key: string) {
    return this.data.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.data.delete(key);
  }

  setItem(key: string, value: string) {
    this.data.set(key, String(value));
  }
}

// Installs functional `localStorage`/`sessionStorage` on `globalThis`/`window`
// and clears them before each test. Call once at the top of a test file.
export function installTestStorage(): void {
  const localStorage = new TestStorage();
  const sessionStorage = new TestStorage();

  for (const target of [globalThis, window]) {
    Object.defineProperty(target, "localStorage", {
      value: localStorage,
      configurable: true,
    });
    Object.defineProperty(target, "sessionStorage", {
      value: sessionStorage,
      configurable: true,
    });
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}
