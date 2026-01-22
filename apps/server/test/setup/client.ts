import app from "../../src/app";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

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
    body: body !== undefined ? JSON.stringify(body) : (undefined as unknown as RequestInit["body"]),
  } as RequestInit);

  return app.request(request as Request);
};

interface RequestOptions {
  headers?: Record<string, string>;
}

const createClient = () => {
  return {
    get: (path: string, options?: RequestOptions) => makeRequest("GET", path, options?.headers ?? {}),
    post: (path: string, body?: unknown, options?: RequestOptions) =>
      makeRequest("POST", path, options?.headers ?? {}, body),
    patch: (path: string, body?: unknown, options?: RequestOptions) =>
      makeRequest("PATCH", path, options?.headers ?? {}, body),
    delete: (path: string, body?: unknown, options?: RequestOptions) =>
      makeRequest("DELETE", path, options?.headers ?? {}, body),
  };
};
export const client = createClient();
