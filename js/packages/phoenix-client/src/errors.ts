/**
 * Thrown when Phoenix answers a request with a non-2xx status.
 *
 * `status` is on the error so callers can branch on it: a status is frequently
 * a legitimate answer rather than a bug — a 401 from an unauthenticated probe,
 * for instance, is how a caller learns that auth is enabled on the deployment.
 */
export class HttpError extends Error {
  readonly response: Response;
  readonly status: number;
  readonly statusText: string;
  readonly url: string;

  constructor(response: Response) {
    super(`${response.url}: ${response.status} ${response.statusText}`);
    this.name = "HttpError";
    this.response = response;
    this.status = response.status;
    this.statusText = response.statusText;
    this.url = response.url;
  }
}
