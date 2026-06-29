import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import type { AppConfig } from './config.js';
import {
  createAuth,
  type AuthContext,
  type AuthProvider,
  type PremiumStore,
} from './auth/index.js';
import { createElevationProvider } from './elevation.js';
import { ActivityStore } from './store.js';
import { FillService } from './services/fill-service.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerActivityRoutes } from './routes/activities.js';
import { registerBillingRoutes } from './routes/billing.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext;
  }
}

export interface AppDeps {
  config: AppConfig;
  auth: AuthProvider;
  premium: PremiumStore;
  currentUserId: () => string;
  store: ActivityStore;
  fillService: FillService;
}

export async function buildApp(config: AppConfig): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
    bodyLimit: config.MAX_UPLOAD_BYTES,
  });

  await app.register(cors, { origin: config.corsOrigins, credentials: true });
  await app.register(multipart, {
    limits: { fileSize: config.MAX_UPLOAD_BYTES, files: 1 },
  });

  const authBundle = createAuth(config);
  const deps: AppDeps = {
    config,
    auth: authBundle.provider,
    premium: authBundle.premium,
    currentUserId: authBundle.currentUserId,
    store: new ActivityStore(),
    fillService: new FillService(createElevationProvider(config)),
  };

  // Resolve identity / entitlement once per request.
  app.decorateRequest('auth');
  app.addHook('onRequest', async (req) => {
    req.auth = await deps.auth.authenticate(req);
  });

  await app.register(
    async (instance) => {
      registerHealthRoutes(instance, deps);
      registerActivityRoutes(instance, deps);
      registerBillingRoutes(instance, deps);
    },
    { prefix: '/api' },
  );

  return app;
}
