export class FetchError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new FetchError(body?.error ?? `Request failed with status ${res.status}`, res.status);
  }
  return res.json();
}
