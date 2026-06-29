import type { AppConfig } from '../config.js';
import type { AuthProvider } from './types.js';
import { DevAuthProvider } from './dev-provider.js';
import { PremiumStore } from './premium-store.js';

export * from './types.js';
export { DevAuthProvider } from './dev-provider.js';
export { PremiumStore } from './premium-store.js';

export interface AuthBundle {
  provider: AuthProvider;
  premium: PremiumStore;
  /** The current user's id for the configured provider (demo: a fixed id). */
  currentUserId(): string;
}

/** Construct the configured auth provider plus its premium store. */
export function createAuth(config: AppConfig): AuthBundle {
  const premium = new PremiumStore();
  const force = config.AUTH_PROVIDER !== 'none' && config.DEV_FORCE_PREMIUM;
  // `stripe` is still a stub; it behaves like the dev provider for now.
  const provider = new DevAuthProvider(force, premium);
  return {
    provider,
    premium,
    currentUserId: () => provider.userId,
  };
}
