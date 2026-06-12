export function jsonRequest(url: string, body: unknown, method = "POST", headers?: HeadersInit) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

export async function responseJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

export function routeParams(values: Record<string, string>) {
  return { params: Promise.resolve(values) };
}
