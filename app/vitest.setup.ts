import "vitest-canvas-mock";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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

const localStorage = new TestStorage();
const sessionStorage = new TestStorage();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorage,
  configurable: true,
});
Object.defineProperty(globalThis, "sessionStorage", {
  value: sessionStorage,
  configurable: true,
});
Object.defineProperty(window, "localStorage", {
  value: localStorage,
  configurable: true,
});
Object.defineProperty(window, "sessionStorage", {
  value: sessionStorage,
  configurable: true,
});

export const baseWindowConfig = {
  authenticationEnabled: true,
  basename: "/",
  platformVersion: "1.0.0",
  authErrorMessages: {},
};
Object.defineProperty(window, "Config", {
  value: baseWindowConfig,
  writable: true,
});
