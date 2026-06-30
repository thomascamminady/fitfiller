import {
  BRouterRoutingProvider,
  NullRoutingProvider,
  type RoutingProvider,
} from '@fitfiller/core';
import type { AppConfig } from './config.js';

/** Build the configured route-snapping provider for "snap to path". */
export function createRoutingProvider(config: AppConfig): RoutingProvider {
  if (config.ROUTING_PROVIDER === 'none') return new NullRoutingProvider();
  return new BRouterRoutingProvider({
    url: config.ROUTING_URL,
    profile: config.ROUTING_PROFILE,
  });
}
