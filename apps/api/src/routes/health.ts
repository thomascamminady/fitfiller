import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../app.js';

export function registerHealthRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): void {
  app.get('/health', async () => ({
    status: 'ok',
    elevation: deps.config.ELEVATION_PROVIDER,
    time: new Date().toISOString(),
  }));

  // Lets the frontend discover identity + premium entitlement.
  app.get('/me', async (req) => req.auth);
}
