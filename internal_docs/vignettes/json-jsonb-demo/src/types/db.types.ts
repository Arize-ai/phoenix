/**
 * Type definitions for database models
 */

export interface User {
  id: number;
  name: string;
  email: string;
  metadata: Record<string, any>;
  preferences: {
    theme: string;
    notifications: boolean;
    language: string;
  };
}

export interface Product {
  id: number;
  name: string;
  price: number;
  attributes: {
    color?: string;
    size?: string;
    weight?: number;
    [key: string]: any;
  };
  tags: string[];
}

export interface Order {
  id: number;
  user_id: number;
  items: Array<{
    product_id: number;
    quantity: number;
    price: number;
  }>;
  status: string;
  shipping_address: {
    street: string;
    city: string;
    country: string;
    postal_code: string;
  };
}
