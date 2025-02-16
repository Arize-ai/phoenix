import { PhoenixClient } from "../client";
/**
 * A uniquely identifiable node in Phoenix
 */
export interface Node {
  id: string;
}

export interface ClientFn {
  /**
   * An instance of the Phoenix client.
   * If not provided, the client will be created using the default configuration.
   */
  client?: PhoenixClient;
}
