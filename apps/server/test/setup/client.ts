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

const createClient = () => {
  return {
    get: (path: string) => makeRequest("GET", path, {}),
    post: (path: string, body?: unknown) => makeRequest("POST", path, {}, body),
    patch: (path: string, body?: unknown) => makeRequest("PATCH", path, {}, body),
    delete: (path: string, body?: unknown) => makeRequest("DELETE", path, {}, body),
  };
};
export const client = createClient();
