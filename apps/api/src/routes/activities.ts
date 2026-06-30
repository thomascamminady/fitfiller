import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { decodeFit, encodeFit } from '@fitfiller/core';
import type { AppDeps } from '../app.js';
import { exportRequestSchema, fillRequestSchema } from '../schemas.js';
import {
  PauseNotFoundError,
  PremiumRequiredError,
} from '../services/fill-service.js';
import { summarize, type ExportSummary } from '../services/summary.js';

/** Strip a `.fit` extension and append the fitfiller suffix. */
function outputName(filename: string): string {
  return filename.replace(/\.fit$/i, '') + '-fit-filler.fit';
}

interface IdParams {
  id: string;
}

export function registerActivityRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): void {
  const { store, fillService } = deps;

  /** Look up an activity, enforcing ownership; replies 404 and returns null. */
  function load(req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const entry = store.get(req.params.id);
    if (
      !entry ||
      (entry.ownerId !== null && entry.ownerId !== req.auth.userId)
    ) {
      reply.code(404).send({ error: 'Activity not found' });
      return null;
    }
    return entry;
  }

  // Upload + decode a FIT file.
  app.post('/activities', async (req, reply) => {
    let file;
    try {
      file = await req.file();
    } catch {
      // Thrown when the request isn't multipart/form-data.
      return reply.code(400).send({ error: 'Expected a multipart FIT file upload' });
    }
    if (!file) {
      return reply.code(400).send({ error: 'Expected a FIT file upload' });
    }
    let buffer: Buffer;
    try {
      buffer = await file.toBuffer();
    } catch {
      // Thrown by @fastify/multipart when the file exceeds the size limit.
      return reply.code(413).send({ error: 'File is too large' });
    }
    let decoded;
    try {
      decoded = decodeFit(new Uint8Array(buffer));
    } catch (err) {
      return reply.code(400).send({
        error: 'Could not parse FIT file',
        detail: err instanceof Error ? err.message : String(err),
      });
    }
    const id = store.put(decoded, file.filename, req.auth.userId);
    return reply.code(201).send({
      id,
      filename: file.filename,
      activity: decoded.activity,
    });
  });

  // Fetch a previously uploaded activity.
  app.get<{ Params: IdParams }>('/activities/:id', async (req, reply) => {
    const entry = load(req, reply);
    if (!entry) return;
    return {
      id: entry.id,
      filename: entry.filename,
      activity: entry.decoded.activity,
    };
  });

  // Preview a single gap fill (returns synthetic records for the map).
  app.post<{ Params: IdParams }>(
    '/activities/:id/preview-fill',
    async (req, reply) => {
      const entry = load(req, reply);
      if (!entry) return;
      const parsed = fillRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'Invalid fill request', detail: parsed.error.issues });
      }
      try {
        const fill = await fillService.build(
          entry.decoded,
          parsed.data,
          req.auth,
        );
        return fill;
      } catch (err) {
        return handleFillError(err, reply);
      }
    },
  );

  // Finalize: apply all fills and stream back a new FIT file.
  app.post<{ Params: IdParams }>(
    '/activities/:id/export',
    async (req, reply) => {
      const entry = load(req, reply);
      if (!entry) return;
      const parsed = exportRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'Invalid export request', detail: parsed.error.issues });
      }
      let bytes: Uint8Array;
      try {
        const fills = await fillService.buildMany(
          entry.decoded,
          parsed.data.fills,
          req.auth,
        );
        bytes = encodeFit(entry.decoded.raw, fills, entry.decoded.fieldDescriptions);
      } catch (err) {
        return handleFillError(err, reply);
      }
      return reply
        .header('Content-Type', 'application/octet-stream')
        .header(
          'Content-Disposition',
          `attachment; filename="${outputName(entry.filename)}"`,
        )
        .send(Buffer.from(bytes));
    },
  );

  // Verify + diff: build the fills, re-encode, then decode the result to prove
  // it isn't corrupted and report what changed.
  app.post<{ Params: IdParams }>(
    '/activities/:id/export-summary',
    async (req, reply) => {
      const entry = load(req, reply);
      if (!entry) return;
      const parsed = exportRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'Invalid export request', detail: parsed.error.issues });
      }
      try {
        const fills = await fillService.buildMany(
          entry.decoded,
          parsed.data.fills,
          req.auth,
        );
        const bytes = encodeFit(entry.decoded.raw, fills, entry.decoded.fieldDescriptions);

        const original = summarize(entry.decoded.activity);
        let ok = true;
        let filled = original;
        try {
          filled = summarize(decodeFit(bytes).activity);
        } catch {
          ok = false;
        }

        const summary: ExportSummary = {
          ok,
          original,
          filled,
          delta: {
            points: filled.points - original.points,
            distanceMeters:
              (filled.distanceMeters ?? 0) - (original.distanceMeters ?? 0),
            durationSeconds:
              (filled.durationSeconds ?? 0) - (original.durationSeconds ?? 0),
            pausesRemoved: original.pauses - filled.pauses,
          },
        };
        return summary;
      } catch (err) {
        return handleFillError(err, reply);
      }
    },
  );
}

function handleFillError(err: unknown, reply: FastifyReply) {
  if (err instanceof PremiumRequiredError) {
    return reply.code(402).send({ error: err.message, code: 'premium_required' });
  }
  if (err instanceof PauseNotFoundError) {
    return reply.code(404).send({ error: err.message });
  }
  if (err instanceof Error) {
    return reply.code(400).send({ error: err.message });
  }
  return reply.code(500).send({ error: 'Unexpected error' });
}
