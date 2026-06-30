import {
  buildGapFill,
  type DecodedFit,
  type ElevationProvider,
  type GapFill,
  type GapFillInput,
  type PauseSegment,
} from '@fitfiller/core';
import type { AuthContext } from '../auth/index.js';
import type { FillRequest } from '../schemas.js';

/** Raised when a request needs premium but the caller isn't entitled. */
export class PremiumRequiredError extends Error {
  constructor(feature: string) {
    super(`Premium feature required: ${feature}`);
    this.name = 'PremiumRequiredError';
  }
}

/** Raised when a fill references a pause that doesn't exist. */
export class PauseNotFoundError extends Error {
  constructor(pauseId: string) {
    super(`Pause not found: ${pauseId}`);
    this.name = 'PauseNotFoundError';
  }
}

function requiresElevation(req: FillRequest): boolean {
  return (
    req.config.elevation?.mode === 'route' || req.config.gradeAdjust === true
  );
}

/**
 * Turns a validated {@link FillRequest} into a {@link GapFill}, enforcing
 * premium gating and resolving route elevation server-side (keeping any API key
 * off the client).
 */
export class FillService {
  constructor(private readonly elevation: ElevationProvider) {}

  private findPause(decoded: DecodedFit, pauseId: string): PauseSegment {
    const pause = decoded.activity.pauses.find((p) => p.id === pauseId);
    if (!pause) throw new PauseNotFoundError(pauseId);
    return pause;
  }

  async build(
    decoded: DecodedFit,
    req: FillRequest,
    auth: AuthContext,
  ): Promise<GapFill> {
    if (requiresElevation(req) && !auth.isPremium) {
      throw new PremiumRequiredError(
        req.config.gradeAdjust ? 'grade-adjusted pace' : 'elevation lookup',
      );
    }

    const pause = this.findPause(decoded, req.pauseId);

    const input: GapFillInput = {
      pause,
      route: req.route,
      config: req.config,
    };

    if (requiresElevation(req)) {
      input.routeElevations = await this.elevation.lookup(req.route);
    }

    return buildGapFill(input);
  }

  async buildMany(
    decoded: DecodedFit,
    reqs: FillRequest[],
    auth: AuthContext,
  ): Promise<GapFill[]> {
    return Promise.all(reqs.map((r) => this.build(decoded, r, auth)));
  }
}
