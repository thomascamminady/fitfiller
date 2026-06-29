import type { FastifyRequest } from 'fastify';

/**
 * Who is making the request and what they're entitled to. This is the single
 * boundary the rest of the app uses to reason about identity and the premium
 * tier — swapping in Stripe + a real session/auth provider later means
 * implementing {@link AuthProvider} without touching any routes.
 */
export interface AuthContext {
  /** Stable user id, or `null` for anonymous/unauthenticated requests. */
  userId: string | null;
  /** Whether premium features (elevation, grade-adjust) are unlocked. */
  isPremium: boolean;
  /** Free-form label for diagnostics, e.g. the provider name. */
  tier: 'anonymous' | 'free' | 'premium';
}

/** Resolves a request to an {@link AuthContext}. */
export interface AuthProvider {
  readonly name: string;
  authenticate(req: FastifyRequest): Promise<AuthContext>;
}

export const ANONYMOUS: AuthContext = {
  userId: null,
  isPremium: false,
  tier: 'anonymous',
};
