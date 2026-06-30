import { describe, it, expect, vi } from 'vitest';
import {
  decodeFit,
  NullRoutingProvider,
  type ElevationProvider,
  type RoutingProvider,
} from '@fitfiller/core';
import {
  FillService,
  PauseNotFoundError,
  PremiumRequiredError,
} from '../services/fill-service.js';
import type { AuthContext } from '../auth/index.js';
import { sampleFit, fillRequestFor } from './fixtures.js';

const FREE: AuthContext = { userId: 'u', isPremium: false, tier: 'free' };
const PREMIUM: AuthContext = { userId: 'u', isPremium: true, tier: 'premium' };

const decoded = () => decodeFit(new Uint8Array(sampleFit()));
const firstPause = () => decoded().activity.pauses[0]!;

class FakeElevation implements ElevationProvider {
  readonly name = 'fake';
  lookup = vi.fn(async (pts: readonly { lat: number; lon: number }[]) =>
    pts.map(() => 250),
  );
}

describe('FillService', () => {
  it('builds a fill for a valid request', async () => {
    const svc = new FillService(new FakeElevation(), new NullRoutingProvider());
    const fill = await svc.build(decoded(), fillRequestFor(firstPause()), FREE);
    expect(fill.records.length).toBeGreaterThan(0);
    expect(fill.pauseId).toBe('pause-0');
  });

  it('throws PauseNotFoundError for an unknown pause', async () => {
    const svc = new FillService(new FakeElevation(), new NullRoutingProvider());
    const req = { ...fillRequestFor(firstPause()), pauseId: 'pause-99' };
    await expect(svc.build(decoded(), req, FREE)).rejects.toBeInstanceOf(
      PauseNotFoundError,
    );
  });

  it('blocks grade-adjust for free users', async () => {
    const svc = new FillService(new FakeElevation(), new NullRoutingProvider());
    const base = fillRequestFor(firstPause());
    const req = { ...base, config: { ...base.config, gradeAdjust: true } };
    await expect(svc.build(decoded(), req, FREE)).rejects.toBeInstanceOf(
      PremiumRequiredError,
    );
  });

  it('blocks route-elevation for free users', async () => {
    const svc = new FillService(new FakeElevation(), new NullRoutingProvider());
    const base = fillRequestFor(firstPause());
    const req = {
      ...base,
      config: { ...base.config, elevation: { mode: 'route' as const } },
    };
    await expect(svc.build(decoded(), req, FREE)).rejects.toBeInstanceOf(
      PremiumRequiredError,
    );
  });

  it('queries the elevation provider for premium route-elevation', async () => {
    const elevation = new FakeElevation();
    const svc = new FillService(elevation, new NullRoutingProvider());
    const base = fillRequestFor(firstPause());
    const req = {
      ...base,
      config: { ...base.config, elevation: { mode: 'route' as const } },
    };
    const fill = await svc.build(decoded(), req, PREMIUM);
    expect(elevation.lookup).toHaveBeenCalledOnce();
    // Filled altitude should reflect the provider's value.
    const moving = fill.records.find((r) => (r.speed ?? 0) > 0)!;
    expect(moving.altitude).toBeCloseTo(250, 0);
  });

  it('does not query elevation when not needed', async () => {
    const elevation = new FakeElevation();
    const svc = new FillService(elevation, new NullRoutingProvider());
    await svc.build(decoded(), fillRequestFor(firstPause()), PREMIUM);
    expect(elevation.lookup).not.toHaveBeenCalled();
  });

  it('buildMany resolves every request', async () => {
    const svc = new FillService(new FakeElevation(), new NullRoutingProvider());
    const fills = await svc.buildMany(
      decoded(),
      [fillRequestFor(firstPause())],
      FREE,
    );
    expect(fills).toHaveLength(1);
  });

  it('snaps the gap through the routed path (a free feature)', async () => {
    const snap = vi.fn(async (pts: readonly { lat: number; lon: number }[]) => [
      pts[0]!,
      { lat: 47.02, lon: 8.05 }, // a detour well off the straight line
      pts[pts.length - 1]!,
    ]);
    const routing: RoutingProvider = { name: 'stub', snap };
    const svc = new FillService(new FakeElevation(), routing);
    const base = fillRequestFor(firstPause());

    const straight = await svc.build(
      decoded(),
      { ...base, config: { ...base.config, snapToPath: false } },
      FREE,
    );
    const snapped = await svc.build(
      decoded(),
      { ...base, config: { ...base.config, snapToPath: true } },
      FREE,
    );

    expect(snap).toHaveBeenCalledTimes(1);
    expect(snapped.addedDistanceMeters).toBeGreaterThan(
      straight.addedDistanceMeters,
    );
  });

  it('falls back to the straight route when snapping fails', async () => {
    const routing: RoutingProvider = { name: 'stub', snap: async () => null };
    const svc = new FillService(new FakeElevation(), routing);
    const base = fillRequestFor(firstPause());

    const straight = await svc.build(
      decoded(),
      { ...base, config: { ...base.config, snapToPath: false } },
      FREE,
    );
    const fallback = await svc.build(
      decoded(),
      { ...base, config: { ...base.config, snapToPath: true } },
      FREE,
    );

    expect(fallback.addedDistanceMeters).toBeCloseTo(
      straight.addedDistanceMeters,
      5,
    );
  });
});
