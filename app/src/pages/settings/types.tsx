export interface APIKey {
  readonly id: string;
  readonly name: string;
  readonly description?: string | null;
  readonly createdAt: string;
  readonly expiresAt?: string | null;
}
