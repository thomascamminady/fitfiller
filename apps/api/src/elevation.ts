import {
  HttpElevationProvider,
  NullElevationProvider,
  type ElevationProvider,
} from '@fitfiller/core';
import type { AppConfig } from './config.js';

const DEFAULT_URLS: Record<string, string> = {
  opentopodata: 'https://api.opentopodata.org/v1/srtm30m',
  'open-elevation': 'https://api.open-elevation.com/api/v1/lookup',
};

/** Build the configured elevation provider (premium enrichment). */
export function createElevationProvider(config: AppConfig): ElevationProvider {
  if (config.ELEVATION_PROVIDER === 'none') return new NullElevationProvider();
  const url =
    config.ELEVATION_API_URL ?? DEFAULT_URLS[config.ELEVATION_PROVIDER];
  if (!url) return new NullElevationProvider();
  return new HttpElevationProvider({
    name: config.ELEVATION_PROVIDER,
    url,
    apiKey: config.ELEVATION_API_KEY,
  });
}
