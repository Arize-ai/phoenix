"""The datagen control page, kept in Python so it ships in the wheel without packaging rules.

Requests use paths relative to the page, so the page works at the server root and behind a
reverse proxy that strips a path prefix.
"""

CONTROL_PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Datagen Control</title>
<style>
  :root { color-scheme: light dark; --bg: #f7f7f8; --card: #fff; --text: #1d1d1f;
          --muted: #6b6b70; --accent: #2f6fde; --border: #dedee3; --bad: #c62828; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #151518; --card: #1f1f23; --text: #ececf0; --muted: #9a9aa2;
            --accent: #6d9bff; --border: #33333a; --bad: #ff6b6b; }
  }
  body { margin: 0; background: var(--bg); color: var(--text);
         font: 14px/1.5 system-ui, -apple-system, sans-serif; }
  main { max-width: 640px; margin: 0 auto; padding: 24px 16px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .muted { color: var(--muted); }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 8px;
          padding: 16px; margin-top: 16px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; }
  .stat b { display: block; font-size: 22px; font-variant-numeric: tabular-nums; }
  label { display: block; font-weight: 600; margin: 12px 0 4px; }
  .row { display: flex; gap: 12px; align-items: center; }
  input[type=range] { flex: 1; accent-color: var(--accent); }
  input[type=number] { width: 96px; padding: 4px 6px; border: 1px solid var(--border);
                       border-radius: 6px; background: transparent; color: inherit; }
  button { padding: 6px 14px; border: 1px solid var(--border); border-radius: 6px;
           background: var(--accent); color: #fff; font: inherit; cursor: pointer; }
  button.secondary { background: transparent; color: inherit; }
  #error { color: var(--bad); min-height: 1.5em; margin-top: 8px; }
</style>
</head>
<body>
<main>
  <h1>Datagen Control</h1>
  <div class="muted" id="status">Connecting...</div>

  <section class="card stats">
    <div class="stat"><span class="muted">Phase</span><b id="phase">-</b></div>
    <div class="stat"><span class="muted">Sent</span><b id="sent">-</b></div>
    <div class="stat"><span class="muted">Failed</span><b id="failed">-</b></div>
    <div class="stat"><span class="muted">Last 60s / min</span><b id="measured">-</b></div>
  </section>

  <section class="card">
    <label for="rate-range">Rate (traces per minute)</label>
    <div class="row">
      <input id="rate-range" type="range" min="-1" max="4" step="0.01">
      <input id="rate" type="number" min="0.1" step="any">
    </div>
    <label for="burst-range">Burstiness (0 is uniform)</label>
    <div class="row">
      <input id="burst-range" type="range" min="0" max="3" step="0.05">
      <input id="burst" type="number" min="0" step="0.05">
    </div>
    <div class="row" style="margin-top: 16px">
      <button id="pause" class="secondary">Pause</button>
      <input id="count" type="number" min="1" max="1000" value="10">
      <button id="send">Send now</button>
    </div>
    <div id="error"></div>
  </section>

  <p class="muted" id="projects"></p>
</main>
<script>
  const base = location.href.endsWith("/") ? location.href : location.href + "/";
  const api = (path) => new URL(path, base);
  const $ = (id) => document.getElementById(id);
  let state = null;
  let editing = false;

  async function call(path, options) {
    const response = await fetch(api(path), options);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || response.statusText);
    return body;
  }

  function render(next) {
    state = next;
    $("status").textContent = next.paused ? "Paused" : "Running";
    $("phase").textContent = next.phase;
    $("sent").textContent = next.sent.toLocaleString();
    $("failed").textContent = next.failed.toLocaleString();
    $("measured").textContent = next.measured_rate.toFixed(1);
    $("pause").textContent = next.paused ? "Resume" : "Pause";
    $("projects").textContent = next.projects.length
      ? "Projects: " + next.projects.join(", ") : "";
    if (!editing) {
      $("rate").value = +next.rate.toPrecision(3);
      $("rate-range").value = Math.log10(next.rate);
      $("burst").value = next.burstiness;
      $("burst-range").value = next.burstiness;
    }
  }

  async function update(changes) {
    try {
      $("error").textContent = "";
      render(await call("api/state", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      }));
    } catch (error) {
      $("error").textContent = error.message;
    }
  }

  async function poll() {
    try {
      render(await call("api/state"));
    } catch (error) {
      $("status").textContent = "Disconnected: " + error.message;
    }
  }

  function bind(rangeId, numberId, toValue, fromValue, field) {
    const range = $(rangeId), number = $(numberId);
    range.addEventListener("input", () => {
      editing = true;
      number.value = +toValue(+range.value).toPrecision(3);
    });
    range.addEventListener("change", () => {
      editing = false;
      update({ [field]: toValue(+range.value) });
    });
    number.addEventListener("focus", () => { editing = true; });
    number.addEventListener("change", () => {
      editing = false;
      range.value = fromValue(+number.value);
      update({ [field]: +number.value });
    });
  }

  bind("rate-range", "rate", (v) => 10 ** v, Math.log10, "rate");
  bind("burst-range", "burst", (v) => v, (v) => v, "burstiness");
  $("pause").addEventListener("click", () => update({ paused: !state?.paused }));
  $("send").addEventListener("click", async () => {
    try {
      $("error").textContent = "";
      render(await call("api/send?n=" + encodeURIComponent($("count").value), { method: "POST" }));
    } catch (error) {
      $("error").textContent = error.message;
    }
  });

  poll();
  setInterval(poll, 1000);
</script>
</body>
</html>
"""
