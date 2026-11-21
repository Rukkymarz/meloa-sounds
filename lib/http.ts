const UA = `MeloaSounds/0.1 ( ${process.env.CONTACT_EMAIL || "contact@example.com"} )`;

/** fetch JSON with a hard timeout so one slow source never blocks a search. */
export async function getJson<T = any>(
  url: string,
  init: RequestInit & { timeoutMs?: number; revalidate?: number } = {},
): Promise<T> {
  const { timeoutMs = 7000, revalidate = 3600, headers, ...rest } = init;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...rest,
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/json", ...(headers || {}) },
      next: { revalidate },
    } as RequestInit);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${new URL(url).host}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function getText(url: string, timeoutMs = 7000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "text/html" },
      next: { revalidate: 86400 },
    } as RequestInit);
    if (!res.ok) throw new Error(`${res.status} for ${new URL(url).host}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export function enc(v: string) {
  return encodeURIComponent(v);
}
