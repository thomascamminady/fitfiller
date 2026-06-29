import { z } from 'zod';

export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

const fillModeSchema = z.object({
  mode: z.enum(['none', 'average', 'value']),
  value: z.number().optional(),
});

export const gapFillConfigSchema = z.object({
  actualBreakSeconds: z.number().min(0).default(0),
  sampleSeconds: z.number().min(1).max(60).optional(),
  heartRate: fillModeSchema.optional(),
  cadence: fillModeSchema.optional(),
  elevation: z.object({ mode: z.enum(['linear', 'route']) }).optional(),
  gradeAdjust: z.boolean().optional(),
});

export const fillRequestSchema = z.object({
  pauseId: z.string(),
  route: z.array(geoPointSchema).min(2),
  config: gapFillConfigSchema,
});

export const exportRequestSchema = z.object({
  fills: z.array(fillRequestSchema).min(1),
});

export type FillRequest = z.infer<typeof fillRequestSchema>;
export type ExportRequest = z.infer<typeof exportRequestSchema>;
