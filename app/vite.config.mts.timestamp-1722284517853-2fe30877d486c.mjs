// vite.config.mts
import react from "file:///Users/parkerstafford/repos/phoenix/app/node_modules/.pnpm/@vitejs+plugin-react@4.3.1_vite@5.3.3/node_modules/@vitejs/plugin-react/dist/index.mjs";
import { resolve } from "path";
import { visualizer } from "file:///Users/parkerstafford/repos/phoenix/app/node_modules/.pnpm/rollup-plugin-visualizer@5.12.0/node_modules/rollup-plugin-visualizer/dist/plugin/index.js";
import { defineConfig } from "file:///Users/parkerstafford/repos/phoenix/app/node_modules/.pnpm/vite@5.3.3/node_modules/vite/dist/node/index.js";
import relay from "file:///Users/parkerstafford/repos/phoenix/app/node_modules/.pnpm/vite-plugin-relay@2.1.0_babel-plugin-relay@17.0.0_vite@5.3.3/node_modules/vite-plugin-relay/dist/plugin.js";
var __vite_injected_original_dirname = "/Users/parkerstafford/repos/phoenix/app";
var vite_config_default = defineConfig(({ command }) => {
  const plugins = [react(), relay];
  if (command === "serve") {
    plugins.push(visualizer());
  }
  return {
    root: resolve(__vite_injected_original_dirname, "src"),
    plugins,
    publicDir: resolve(__vite_injected_original_dirname, "static"),
    preview: {
      port: 6006
    },
    server: {
      open: "http://localhost:6006"
    },
    resolve: {
      alias: {
        "@phoenix": resolve(__vite_injected_original_dirname, "src")
      }
    },
    build: {
      manifest: true,
      outDir: resolve(__vite_injected_original_dirname, "../src/phoenix/server/static"),
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(__vite_injected_original_dirname, "src/index.tsx"),
        output: {
          manualChunks: (id) => {
            if (id.includes("node_modules")) {
              if (id.includes("three/build")) {
                return "vendor-three";
              }
              if (id.includes("recharts")) {
                return "vendor-recharts";
              }
              if (id.includes("codemirror")) {
                return "vendor-codemirror";
              }
              if (id.includes("@arizeai/components")) {
                return "vendor-arizeai";
              }
              return "vendor";
            }
            if (id.includes("src/components")) {
              return "components";
            }
            if (id.includes("src/pages")) {
              return "pages";
            }
          }
        }
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcubXRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL3BhcmtlcnN0YWZmb3JkL3JlcG9zL3Bob2VuaXgvYXBwXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvcGFya2Vyc3RhZmZvcmQvcmVwb3MvcGhvZW5peC9hcHAvdml0ZS5jb25maWcubXRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy9wYXJrZXJzdGFmZm9yZC9yZXBvcy9waG9lbml4L2FwcC92aXRlLmNvbmZpZy5tdHNcIjtpbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCI7XG5pbXBvcnQgeyByZXNvbHZlIH0gZnJvbSBcInBhdGhcIjtcbmltcG9ydCB7IHZpc3VhbGl6ZXIgfSBmcm9tIFwicm9sbHVwLXBsdWdpbi12aXN1YWxpemVyXCI7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlbGF5IGZyb20gXCJ2aXRlLXBsdWdpbi1yZWxheVwiO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgY29tbWFuZCB9KSA9PiB7XG4gIGNvbnN0IHBsdWdpbnMgPSBbcmVhY3QoKSwgcmVsYXldO1xuICAvLyBEZXZlbG9wbWVudCB1c2VzIHRoZSBzZXJ2ZSBjb21tYW5kXG4gIGlmIChjb21tYW5kID09PSBcInNlcnZlXCIpIHtcbiAgICBwbHVnaW5zLnB1c2godmlzdWFsaXplcigpKTtcbiAgfVxuICByZXR1cm4ge1xuICAgIHJvb3Q6IHJlc29sdmUoX19kaXJuYW1lLCBcInNyY1wiKSxcbiAgICBwbHVnaW5zLFxuICAgIHB1YmxpY0RpcjogcmVzb2x2ZShfX2Rpcm5hbWUsIFwic3RhdGljXCIpLFxuICAgIHByZXZpZXc6IHtcbiAgICAgIHBvcnQ6IDYwMDYsXG4gICAgfSxcbiAgICBzZXJ2ZXI6IHtcbiAgICAgIG9wZW46IFwiaHR0cDovL2xvY2FsaG9zdDo2MDA2XCIsXG4gICAgfSxcbiAgICByZXNvbHZlOiB7XG4gICAgICBhbGlhczoge1xuICAgICAgICBcIkBwaG9lbml4XCI6IHJlc29sdmUoX19kaXJuYW1lLCBcInNyY1wiKSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBidWlsZDoge1xuICAgICAgbWFuaWZlc3Q6IHRydWUsXG4gICAgICBvdXREaXI6IHJlc29sdmUoX19kaXJuYW1lLCBcIi4uL3NyYy9waG9lbml4L3NlcnZlci9zdGF0aWNcIiksXG4gICAgICBlbXB0eU91dERpcjogdHJ1ZSxcbiAgICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgICAgaW5wdXQ6IHJlc29sdmUoX19kaXJuYW1lLCBcInNyYy9pbmRleC50c3hcIiksXG4gICAgICAgIG91dHB1dDoge1xuICAgICAgICAgIG1hbnVhbENodW5rczogKGlkKSA9PiB7XG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXNcIikpIHtcbiAgICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwidGhyZWUvYnVpbGRcIikpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gXCJ2ZW5kb3ItdGhyZWVcIjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJyZWNoYXJ0c1wiKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBcInZlbmRvci1yZWNoYXJ0c1wiO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcImNvZGVtaXJyb3JcIikpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gXCJ2ZW5kb3ItY29kZW1pcnJvclwiO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIkBhcml6ZWFpL2NvbXBvbmVudHNcIikpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gXCJ2ZW5kb3ItYXJpemVhaVwiO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiBcInZlbmRvclwiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwic3JjL2NvbXBvbmVudHNcIikpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIFwiY29tcG9uZW50c1wiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwic3JjL3BhZ2VzXCIpKSB7XG4gICAgICAgICAgICAgIHJldHVybiBcInBhZ2VzXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF5UyxPQUFPLFdBQVc7QUFDM1QsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sV0FBVztBQUpsQixJQUFNLG1DQUFtQztBQU16QyxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLFFBQVEsTUFBTTtBQUMzQyxRQUFNLFVBQVUsQ0FBQyxNQUFNLEdBQUcsS0FBSztBQUUvQixNQUFJLFlBQVksU0FBUztBQUN2QixZQUFRLEtBQUssV0FBVyxDQUFDO0FBQUEsRUFDM0I7QUFDQSxTQUFPO0FBQUEsSUFDTCxNQUFNLFFBQVEsa0NBQVcsS0FBSztBQUFBLElBQzlCO0FBQUEsSUFDQSxXQUFXLFFBQVEsa0NBQVcsUUFBUTtBQUFBLElBQ3RDLFNBQVM7QUFBQSxNQUNQLE1BQU07QUFBQSxJQUNSO0FBQUEsSUFDQSxRQUFRO0FBQUEsTUFDTixNQUFNO0FBQUEsSUFDUjtBQUFBLElBQ0EsU0FBUztBQUFBLE1BQ1AsT0FBTztBQUFBLFFBQ0wsWUFBWSxRQUFRLGtDQUFXLEtBQUs7QUFBQSxNQUN0QztBQUFBLElBQ0Y7QUFBQSxJQUNBLE9BQU87QUFBQSxNQUNMLFVBQVU7QUFBQSxNQUNWLFFBQVEsUUFBUSxrQ0FBVyw4QkFBOEI7QUFBQSxNQUN6RCxhQUFhO0FBQUEsTUFDYixlQUFlO0FBQUEsUUFDYixPQUFPLFFBQVEsa0NBQVcsZUFBZTtBQUFBLFFBQ3pDLFFBQVE7QUFBQSxVQUNOLGNBQWMsQ0FBQyxPQUFPO0FBQ3BCLGdCQUFJLEdBQUcsU0FBUyxjQUFjLEdBQUc7QUFDL0Isa0JBQUksR0FBRyxTQUFTLGFBQWEsR0FBRztBQUM5Qix1QkFBTztBQUFBLGNBQ1Q7QUFDQSxrQkFBSSxHQUFHLFNBQVMsVUFBVSxHQUFHO0FBQzNCLHVCQUFPO0FBQUEsY0FDVDtBQUNBLGtCQUFJLEdBQUcsU0FBUyxZQUFZLEdBQUc7QUFDN0IsdUJBQU87QUFBQSxjQUNUO0FBQ0Esa0JBQUksR0FBRyxTQUFTLHFCQUFxQixHQUFHO0FBQ3RDLHVCQUFPO0FBQUEsY0FDVDtBQUNBLHFCQUFPO0FBQUEsWUFDVDtBQUNBLGdCQUFJLEdBQUcsU0FBUyxnQkFBZ0IsR0FBRztBQUNqQyxxQkFBTztBQUFBLFlBQ1Q7QUFDQSxnQkFBSSxHQUFHLFNBQVMsV0FBVyxHQUFHO0FBQzVCLHFCQUFPO0FBQUEsWUFDVDtBQUFBLFVBQ0Y7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
