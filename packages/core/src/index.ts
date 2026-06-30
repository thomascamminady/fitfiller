// Domain model
export * from './domain/types.js';

// FIT codec
export { decodeFit } from './fit/decode.js';
export type { DecodedFit, RawMessage } from './fit/decode.js';
export { encodeFit } from './fit/encode.js';
export {
  semicirclesToDegrees,
  degreesToSemicircles,
} from './fit/semicircles.js';

// Pause detection
export { detectPauses } from './pause/detect.js';
export type { DetectPausesOptions } from './pause/detect.js';

// Gap filling
export {
  buildGapFill,
  straightRoute,
  routeDistanceMeters,
} from './gap/fill.js';
export type {
  GapFill,
  GapFillConfig,
  GapFillInput,
  FillMode,
} from './gap/fill.js';

// Geo helpers
export {
  haversineMeters,
  polylineLengthMeters,
  cumulativeDistances,
  lerpPoint,
  pointAtDistance,
} from './geo/distance.js';

// Elevation
export {
  NullElevationProvider,
  HttpElevationProvider,
} from './elevation/provider.js';
export type {
  ElevationProvider,
  HttpElevationProviderOptions,
} from './elevation/provider.js';

// Routing (snap a drawn gap to the path network)
export {
  NullRoutingProvider,
  BRouterRoutingProvider,
} from './routing/provider.js';
export type {
  RoutingProvider,
  BRouterRoutingProviderOptions,
} from './routing/provider.js';
