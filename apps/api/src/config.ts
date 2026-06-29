import { z } from 'zod';
import 'dotenv/config';

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  MAX_UPLOAD_BYTES: z.coerce.number().default(25 * 1024 * 1024),

  AUTH_PROVIDER: z.enum(['none', 'dev', 'stripe']).default('dev'),
  DEV_FORCE_PREMIUM: bool,

  // Defaults to OpenTopoData (free, no key). Lookups that fail fall back to
  // linear interpolation, so this never breaks a fill — set to `none` to skip
  // network calls entirely (e.g. in tests).
  ELEVATION_PROVIDER: z
    .enum(['none', 'opentopodata', 'open-elevation'])
    .default('opentopodata'),
  ELEVATION_API_URL: z.string().optional(),
  ELEVATION_API_KEY: z.string().optional(),
});

export type AppConfig = z.infer<typeof schema> & {
  corsOrigins: string[];
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = schema.parse(env);
  return {
    ...parsed,
    corsOrigins: parsed.CORS_ORIGIN.split(',').map((s) => s.trim()),
  };
}
