/**
 * Run `callback` once `document.body` exists. The manager bundle can evaluate
 * before the body is parsed, and a MutationObserver needs a node to observe.
 */
export function whenBodyReady(callback: () => void) {
  if (document.body) {
    callback();
  } else {
    document.addEventListener("DOMContentLoaded", callback, { once: true });
  }
}
