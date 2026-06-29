import type {
  AuthContext,
  ExportSummary,
  FillRequest,
  GapFill,
  UploadResponse,
} from './types';

/** Thrown for non-2xx responses; carries the parsed error body. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  let body: { error?: string; code?: string } = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON error */
  }
  throw new ApiError(res.status, body.error ?? res.statusText, body.code);
}

export const api = {
  async me(): Promise<AuthContext> {
    return unwrap(await fetch('/api/me'));
  },

  async upload(file: File): Promise<UploadResponse> {
    const form = new FormData();
    form.append('file', file);
    return unwrap(
      await fetch('/api/activities', { method: 'POST', body: form }),
    );
  },

  async previewFill(id: string, req: FillRequest): Promise<GapFill> {
    return unwrap(
      await fetch(`/api/activities/${id}/preview-fill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      }),
    );
  },

  async exportSummary(id: string, fills: FillRequest[]): Promise<ExportSummary> {
    return unwrap(
      await fetch(`/api/activities/${id}/export-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fills }),
      }),
    );
  },

  /** Unlock premium (demo billing). Returns the new entitlement. */
  async subscribe(): Promise<AuthContext> {
    return unwrap(await fetch('/api/billing/subscribe', { method: 'POST' }));
  },

  /** Export the filled activity; returns the new FIT file as a Blob. */
  async export(id: string, fills: FillRequest[]): Promise<Blob> {
    const res = await fetch(`/api/activities/${id}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fills }),
    });
    if (!res.ok) {
      let body: { error?: string; code?: string } = {};
      try {
        body = await res.json();
      } catch {
        /* ignore */
      }
      throw new ApiError(res.status, body.error ?? res.statusText, body.code);
    }
    return res.blob();
  },
};
