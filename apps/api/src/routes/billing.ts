import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../app.js';

/**
 * Demo billing. In production this is where Stripe Checkout would start and a
 * webhook would confirm the subscription; here `subscribe` simply unlocks
 * premium for the current user so the flow is clickable end-to-end.
 */
export function registerBillingRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): void {
  app.post('/billing/subscribe', async (req) => {
    const userId = req.auth.userId ?? deps.currentUserId();
    deps.premium.grant(userId);
    return { isPremium: true, tier: 'premium', userId };
  });

  app.post('/billing/cancel', async (req) => {
    const userId = req.auth.userId ?? deps.currentUserId();
    deps.premium.revoke(userId);
    return { isPremium: false, tier: 'free', userId };
  });
}
