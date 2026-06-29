/**
 * In-memory record of which users have unlocked premium.
 *
 * This is the seam where real billing slots in: a Stripe webhook would mark a
 * user premium here (or in a database) instead of the demo `subscribe` route.
 */
export class PremiumStore {
  private readonly premium = new Set<string>();

  isPremium(userId: string | null): boolean {
    return userId !== null && this.premium.has(userId);
  }

  grant(userId: string): void {
    this.premium.add(userId);
  }

  revoke(userId: string): void {
    this.premium.delete(userId);
  }
}
