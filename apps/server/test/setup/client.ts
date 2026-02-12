import type { Hono } from "hono";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  headers?: Record<string, string>;
}

export interface Client {
  get: (path: string, options?: RequestOptions) => Promise<Response>;
  post: (path: string, body?: unknown, options?: RequestOptions) => Promise<Response>;
  put: (path: string, body?: unknown, options?: RequestOptions) => Promise<Response>;
  patch: (path: string, body?: unknown, options?: RequestOptions) => Promise<Response>;
  delete: (path: string, body?: unknown, options?: RequestOptions) => Promise<Response>;
}

export const createClient = async (): Promise<Client> => {
  const { default: app } = await import("../../src/app");

  const makeRequest = async (
    method: HttpMethod,
    path: string,
    headers: Record<string, string>,
    body?: unknown,
  ): Promise<Response> => {
    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
    };

    const request = new Request(`http://localhost${path}`, {
      method,
      headers: requestHeaders,
      body:
        body !== undefined ? JSON.stringify(body) : (undefined as unknown as RequestInit["body"]),
    } as RequestInit);

    return (app as Hono).request(request as Request);
  };

  return {
    get: (path: string, options?: RequestOptions) =>
      makeRequest("GET", path, options?.headers ?? {}),
    post: (path: string, body?: unknown, options?: RequestOptions) =>
      makeRequest("POST", path, options?.headers ?? {}, body),
    patch: (path: string, body?: unknown, options?: RequestOptions) =>
      makeRequest("PATCH", path, options?.headers ?? {}, body),
    delete: (path: string, body?: unknown, options?: RequestOptions) =>
      makeRequest("DELETE", path, options?.headers ?? {}, body),
  };
};

// Default client for tests that don't need to reset modules
export const client = await createClient();
