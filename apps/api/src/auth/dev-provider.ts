import type { FastifyRequest } from 'fastify';
import type { AuthContext, AuthProvider } from './types.js';
import type { PremiumStore } from './premium-store.js';

/**
 * Development auth provider. Everyone is the same demo user; premium is unlocked
 * either by config (`DEV_FORCE_PREMIUM`) or at runtime via the billing route,
 * which records the user in the {@link PremiumStore}. This is a placeholder for
 * a real session/OAuth provider — see {@link AuthProvider}.
 */
export class DevAuthProvider implements AuthProvider {
  readonly name = 'dev';
  readonly userId = 'dev-user';

  constructor(
    private readonly forcePremium: boolean,
    private readonly premium: PremiumStore,
  ) {}

  async authenticate(_req: FastifyRequest): Promise<AuthContext> {
    const isPremium = this.forcePremium || this.premium.isPremium(this.userId);
    return {
      userId: this.userId,
      isPremium,
      tier: isPremium ? 'premium' : 'free',
    };
  }
}
