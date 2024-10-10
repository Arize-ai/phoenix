import { phoenix } from "./src";

phoenix.client.setConfig({
  baseUrl: "http://localhost:6006",
});

phoenix
  .listDatasets()
  .then((r) => r.data)
  .then(console.log);
