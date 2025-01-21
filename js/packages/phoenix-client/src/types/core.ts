import { PhoenixClient } from "../client";
/**
 * A uniquely identifiable node in Phoenix
 */
export interface Node {
  id: string;
}

export interface ClientFn {
  client?: PhoenixClient;
}
