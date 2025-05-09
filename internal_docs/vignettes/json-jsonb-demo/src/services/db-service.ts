import { Pool, QueryResult, QueryResultRow } from "pg";
import { User, Product, Order } from "../types/db.types.js";
import { USE_PGLITE } from "../config/db-config.js";
import { PGlite } from "@electric-sql/pglite";

interface PGliteResult {
  rows: any[];
}

class DatabaseService {
  private pool: Pool | PGlite;
  private isPGlite: boolean;

  constructor() {
    this.isPGlite = USE_PGLITE;
    if (this.isPGlite) {
      this.pool = new PGlite();
    } else {
      this.pool = new Pool({
        user: process.env.DB_USER || "postgres",
        host: process.env.DB_HOST || "localhost",
        database: process.env.DB_NAME || "json_demo",
        password: process.env.DB_PASSWORD || "postgres",
        port: parseInt(process.env.DB_PORT || "5432", 10),
      });
    }
  }

  async initialize(): Promise<void> {
    try {
      if (this.isPGlite) {
        await (this.pool as PGlite).query("SELECT 1");
        console.log("PGlite initialized");
      } else {
        await (this.pool as Pool).connect();
        console.log("Successfully connected to PostgreSQL");
      }
    } catch (error) {
      console.error("Error initializing database:", error);
      throw error;
    }
  }

  async query<T extends QueryResultRow = any>(
    sql: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    try {
      if (this.isPGlite) {
        const result = (await (this.pool as PGlite).query(
          sql,
          params
        )) as PGliteResult;
        return {
          rows: result.rows as T[],
          command: "",
          rowCount: result.rows.length,
          oid: 0,
          fields: [],
        };
      } else {
        return await (this.pool as Pool).query<T>(sql, params);
      }
    } catch (error) {
      console.error("Error executing query:", error);
      throw error;
    }
  }

  async createTables(): Promise<void> {
    const createTablesSQL = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        metadata JSONB DEFAULT '{}',
        preferences JSONB DEFAULT '{"theme": "light", "notifications": true, "language": "en"}'
      );

      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        attributes JSONB DEFAULT '{}',
        tags JSONB DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        items JSONB NOT NULL,
        status VARCHAR(50) NOT NULL,
        shipping_address JSONB NOT NULL
      );
    `;

    try {
      await this.query(createTablesSQL);
      console.log("Tables created successfully");
    } catch (error) {
      console.error("Error creating tables:", error);
      throw error;
    }
  }

  async insertUser(user: Omit<User, "id">): Promise<User> {
    const sql = `
      INSERT INTO users (name, email, metadata, preferences)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await this.query<User>(sql, [
      user.name,
      user.email,
      user.metadata,
      user.preferences,
    ]);
    return result.rows[0];
  }

  async insertProduct(product: Omit<Product, "id">): Promise<Product> {
    const sql = `
      INSERT INTO products (name, price, attributes, tags)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await this.query<Product>(sql, [
      product.name,
      product.price,
      product.attributes,
      product.tags,
    ]);
    return result.rows[0];
  }

  async insertOrder(order: Omit<Order, "id">): Promise<Order> {
    const sql = `
      INSERT INTO orders (user_id, items, status, shipping_address)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await this.query<Order>(sql, [
      order.user_id,
      order.items,
      order.status,
      order.shipping_address,
    ]);
    return result.rows[0];
  }

  async close(): Promise<void> {
    try {
      if (this.isPGlite) {
        await (this.pool as PGlite).close();
      } else {
        await (this.pool as Pool).end();
      }
      console.log("Database connection closed");
    } catch (error) {
      console.error("Error closing database connection:", error);
      throw error;
    }
  }
}

export default new DatabaseService();
