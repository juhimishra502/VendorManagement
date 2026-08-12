const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

/** Fetch a file (e.g. CSV) with the session cookie and trigger a browser download. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: "include" });
  if (!response.ok) throw new ApiError(response.status, `Export failed (${response.status})`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public issues?: unknown,
  ) {
    super(message);
  }
}

/** Thin fetch wrapper that always sends the session cookie and unwraps `{ success, data }`. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // no JSON body
  }

  if (!response.ok) {
    const err = body as { error?: string; issues?: unknown } | null;
    throw new ApiError(response.status, err?.error ?? `Request failed (${response.status})`, err?.issues);
  }

  const envelope = body as { success: boolean; data: T };
  return envelope.data;
}
