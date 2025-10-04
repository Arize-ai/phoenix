# Vite Dev Server - Technical Notes

## Problems & Solutions

### 1. Port Conflict Avoidance
**Problem:** Don't want Vite's 5173 exposed on host (conflicts, security)  
**Solution:** Route everything through Traefik on port 18273
- Vite container: `expose: ["5173"]` (internal only, no `ports:` mapping)
- Traefik label: `traefik.http.services.vite-dev.loadbalancer.server.port=5173`
- Client connects to: `http://localhost:18273/phoenix/vite/...`

### 2. Path Prefixing
**Problem:** Vite expects to serve from `/`, but we need `/phoenix/vite/`  
**Solution:** 
- **Vite CLI:** `vite --base /phoenix/vite/` in Dockerfile CMD
- **Phoenix template transformation:** `scripts/docker/devops/Dockerfile.vite:34`
  ```dockerfile
  RUN sed -i "s|http://localhost:5173|/phoenix/vite|g" \
      /phoenix/env/phoenix/server/templates/index.html
  ```
  Transforms:
  ```html
  <script src="http://localhost:5173/@vite/client"></script>
  ```
  Into:
  ```html
  <script src="/phoenix/vite/@vite/client"></script>
  ```

### 3. HMR WebSocket Routing
**Problem:** HMR WebSocket connects to port 18273, but Vite listens on 5173  
**Solution:** Configure client port via env var
- **docker-compose.yml:** `VITE_HMR_CLIENT_PORT=18273`
- **vite.config.mts:**
  ```ts
  server: {
    hmr: process.env.VITE_HMR_CLIENT_PORT
      ? { clientPort: parseInt(process.env.VITE_HMR_CLIENT_PORT) }
      : true  // Default behavior for local dev
  }
  ```
- Browser connects: `ws://localhost:18273/phoenix/vite/@vite/hmr`
- Traefik routes to: `vite-dev:5173` container

### 4. Vite Host Validation
**Problem:** Vite blocks requests from Docker hostnames  
Error: `Blocked request. This host ("vite-dev") is not allowed.`

**Solution:** Disable host checking in config
- **vite.config.mts:**
  ```ts
  server: {
    allowedHosts: "all"
  }
  ```
- **Vite CLI:** `--host 0.0.0.0` (listen on all interfaces)

### 5. Traefik Routing
**Problem:** Route Vite assets without breaking Phoenix API/GraphQL routes  
**Solution:** Namespace separation with priority routing
- **Vite routes (priority 100):**
  ```yaml
  traefik.http.routers.vite-dev.rule: Host(`localhost`) && PathPrefix(`/phoenix/vite`)
  traefik.http.routers.vite-dev.priority: 100
  ```
- **Phoenix routes (default priority):**
  ```yaml
  traefik.http.routers.phoenix.rule: Host(`localhost`) && PathPrefix(`/phoenix`)
  ```
- Result:
  - `/phoenix/vite/*` → Vite (matches first, higher priority)
  - `/phoenix/openapi.json` → Phoenix
  - `/phoenix/graphql` → Phoenix

### 6. Source Code Isolation
**Problem:** Don't want Docker-specific config polluting version control  
**Solution:** Environment variable pattern for optional overrides

**app/vite.config.mts** (clean, works locally AND in Docker):
```ts
server: {
  allowedHosts: "all",
  hmr: process.env.VITE_HMR_CLIENT_PORT
    ? { clientPort: parseInt(process.env.VITE_HMR_CLIENT_PORT) }
    : true,
  open: "http://localhost:6006"
}
```

**Behavior:**
- **Local dev:** No env var set → `hmr: true` (default port 5173)
- **Docker:** `VITE_HMR_CLIENT_PORT=18273` → `hmr: { clientPort: 18273 }`

### 7. Volume Mount Conflicts
**Problem:** Host's `node_modules` conflicts with container's  
**Solution:** Anonymous volume overlay
```yaml
volumes:
  - ../../../app:/app:cached           # Mount source code
  - /app/node_modules                  # Prevent host from overwriting
```
Container's `node_modules` takes precedence over host's.

## Architecture

```
Browser (localhost:18273)
    ↓
Traefik (reverse proxy)
    ├─ /phoenix/vite/*  [priority:100] → vite-dev:5173
    │                                     ├─ Vite dev server
    │                                     ├─ HMR WebSocket
    │                                     └─ ESM transformation
    │
    └─ /phoenix/*       [default]      → phoenix:6006
                                          ├─ FastAPI backend
                                          ├─ GraphQL API
                                          └─ Serves index.html (--dev mode)
```

**Request flow example:**
1. `GET /phoenix/` → Phoenix → Returns HTML with `<script src="/phoenix/vite/@vite/client">`
2. `GET /phoenix/vite/@vite/client` → Traefik → Vite → JS bundle
3. `GET /phoenix/vite/src/index.tsx` → Traefik → Vite → Transformed module
4. `WS /phoenix/vite/@vite/hmr` → Traefik → Vite → HMR updates

## Usage

**Default (Vite enabled):**
```bash
cd scripts/docker/devops
./dev.sh up
```

**Disable Vite (production mode):**
```bash
./dev.sh up --profile no-vite
```

**Access:** http://localhost:18273/phoenix/

## Performance Tuning

**Current resource limits (docker-compose.yml):**
```yaml
vite-dev:
  deploy:
    resources:
      limits:
        memory: 4G
        cpus: "8.0"
```

Adjust based on host machine capacity. More CPU = faster:
- Initial dependency pre-bundling
- Concurrent module transformations
- HMR update speed

## Debugging

**Check if Vite is running:**
```bash
docker-compose logs vite-dev | tail -20
# Should see: "VITE v6.x.x ready in XXX ms"
```

**Test Vite directly:**
```bash
curl http://localhost:18273/phoenix/vite/@vite/client | head -5
# Should return JavaScript (not HTML/404)
```

**Check Traefik routing:**
```bash
docker-compose logs traefik | grep vite-dev
# Look for: RouterName":"vite-dev@docker"
```

**Verify HMR WebSocket:**
- Browser DevTools → Network → WS tab
- Should see: `ws://localhost:18273/phoenix/vite/@vite/hmr` with status 101