import { useEffect, useRef } from 'react';
import maplibregl, {
  type Map as MlMap,
  type GeoJSONSource,
  type ExpressionSpecification,
  Marker,
} from 'maplibre-gl';
import type { GeoPoint, PauseSegment, TrackPoint } from '../types';
import { STATUS_META, type PauseStatus } from '../pauseStatus';

const MAP_STYLE =
  import.meta.env.VITE_MAP_STYLE ??
  'https://tiles.openfreemap.org/styles/liberty';

const TRACE = '#1b1b1b'; // recorded track — black
const PAUSE = '#2563eb'; // where the watch paused — blue
const RESUME = '#dc2626'; // where it resumed — red
const FILL = '#1f6f4a'; // the reconstructed segment — green

interface Props {
  points: TrackPoint[];
  pauses: PauseSegment[];
  pauseStatuses: Record<string, PauseStatus>;
  activePause: PauseSegment | null;
  route: GeoPoint[];
  previewRecords: TrackPoint[] | null;
  drawing: boolean;
  onAddWaypoint: (p: GeoPoint) => void;
}

type FC = GeoJSON.FeatureCollection;

const EMPTY: FC = { type: 'FeatureCollection', features: [] };

function lineFrom(coords: [number, number][]): FC {
  if (coords.length < 2) return EMPTY;
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords },
      },
    ],
  };
}

function pointsFrom(coords: [number, number][]): FC {
  return {
    type: 'FeatureCollection',
    features: coords.map((c) => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: c },
    })),
  };
}

/** Points tagged with a pause status so MapLibre can colour them per-feature. */
function statusPointsFrom(
  items: { coord: [number, number]; status: PauseStatus }[],
): FC {
  return {
    type: 'FeatureCollection',
    features: items.map((it) => ({
      type: 'Feature',
      properties: { status: it.status },
      geometry: { type: 'Point', coordinates: it.coord },
    })),
  };
}

// Per-feature colour from the `status` property; matches the ribbon & chart.
const STATUS_CIRCLE_COLOR: ExpressionSpecification = [
  'match',
  ['get', 'status'],
  'issue',
  STATUS_META.issue.color,
  'fixed',
  STATUS_META.fixed.color,
  'nogps',
  STATUS_META.nogps.color,
  STATUS_META.break.color,
];

const trackCoords = (pts: { lat: number | null; lon: number | null }[]) =>
  pts
    .filter((p) => p.lat !== null && p.lon !== null)
    .map((p) => [p.lon as number, p.lat as number] as [number, number]);

const endpoint = (p: TrackPoint): [number, number] | null =>
  p.lat !== null && p.lon !== null ? [p.lon, p.lat] : null;

/** A labelled DOM pin (no map glyphs needed) for an active pause endpoint. */
function makePin(label: string, color: string): Marker {
  const el = document.createElement('div');
  el.className = 'map-pin';
  el.innerHTML =
    `<span class="map-pin-label">${label}</span>` +
    `<span class="map-pin-stem"></span>` +
    `<span class="map-pin-dot" style="background:${color}"></span>`;
  return new Marker({ element: el, anchor: 'bottom' });
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function MapView({
  points,
  pauses,
  pauseStatuses,
  activePause,
  route,
  previewRecords,
  drawing,
  onAddWaypoint,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const readyRef = useRef(false);
  const initialFitRef = useRef(false);
  const beforePinRef = useRef<Marker | null>(null);
  const afterPinRef = useRef<Marker | null>(null);

  const drawingRef = useRef(drawing);
  const onAddRef = useRef(onAddWaypoint);
  drawingRef.current = drawing;
  onAddRef.current = onAddWaypoint;

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [0, 20],
      zoom: 1.5,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'top-right',
    );
    beforePinRef.current = makePin('Paused', PAUSE);
    afterPinRef.current = makePin('Resumed', RESUME);

    map.on('load', () => {
      const addLine = (
        id: string,
        color: string,
        width: number,
        opts: { dash?: number[]; opacity?: number } = {},
      ) => {
        map.addSource(id, { type: 'geojson', data: EMPTY });
        map.addLayer({
          id,
          type: 'line',
          source: id,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': color,
            'line-width': width,
            'line-opacity': opts.opacity ?? 1,
            ...(opts.dash ? { 'line-dasharray': opts.dash } : {}),
          },
        });
      };
      const addCircle = (
        id: string,
        color: string | ExpressionSpecification,
        radius: number,
        stroke = 0,
        opacity = 1,
      ) => {
        map.addSource(id, { type: 'geojson', data: EMPTY });
        map.addLayer({
          id,
          type: 'circle',
          source: id,
          paint: {
            'circle-color': color,
            'circle-radius': radius,
            'circle-opacity': opacity,
            'circle-stroke-width': stroke,
            'circle-stroke-color': '#ffffff',
          },
        });
      };

      // Bottom → top. The black track is context; the active repair pops via
      // the blue/red endpoint pins and the green fill.
      addLine('track', TRACE, 3, { opacity: 0.85 }); // recorded track (black)
      addCircle('pause-pts', STATUS_CIRCLE_COLOR, 5, 1.5, 0.95); // other pauses, by status
      addLine('gap', FILL, 3, { dash: [1.5, 1.8] }); // the section being repaired
      addLine('preview-casing', '#ffffff', 9); // halo so the fill pops
      addLine('preview', FILL, 5); // the filled track (hero)
      addCircle('route-pts', FILL, 4.5, 2); // drawn waypoints

      readyRef.current = true;
      sync();
      syncPins();
      focusActive();
    });

    map.on('click', (e) => {
      if (drawingRef.current)
        onAddRef.current({ lat: e.lngLat.lat, lon: e.lngLat.lng });
    });

    return () => {
      beforePinRef.current?.remove();
      afterPinRef.current?.remove();
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push current props into the map sources.
  function sync() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const src = (id: string) => map.getSource(id) as GeoJSONSource | undefined;

    src('track')?.setData(lineFrom(trackCoords(points)));

    // Inactive pauses only — the active one is shown via pins + the gap line.
    // Each dot is coloured by its status so problems stand out on the map.
    const otherPauses = pauses
      .filter((p) => p.id !== activePause?.id)
      .flatMap((p) => {
        const status = pauseStatuses[p.id] ?? 'break';
        const ends = [endpoint(p.before), endpoint(p.after)];
        return ends
          .filter((c): c is [number, number] => c !== null)
          .map((coord) => ({ coord, status }));
      });
    src('pause-pts')?.setData(statusPointsFrom(otherPauses));

    // The active repair: orange "gap" line until a green fill is previewed.
    const routeCoords = route.map((p) => [p.lon, p.lat] as [number, number]);
    src('gap')?.setData(activePause ? lineFrom(routeCoords) : EMPTY);
    src('route-pts')?.setData(pointsFrom(routeCoords.slice(1, -1)));

    const previewLine = previewRecords
      ? lineFrom(trackCoords(previewRecords))
      : EMPTY;
    src('preview')?.setData(previewLine);
    src('preview-casing')?.setData(previewLine);
    // Once filled, fade the dashed proposal so the solid green result reads clearly.
    map.setPaintProperty('gap', 'line-opacity', previewRecords ? 0.2 : 0.95);
  }

  // Position the labelled pins on the active pause's endpoints.
  function syncPins() {
    const map = mapRef.current;
    const before = beforePinRef.current;
    const after = afterPinRef.current;
    if (!map || !before || !after) return;
    const b = activePause ? endpoint(activePause.before) : null;
    const a = activePause ? endpoint(activePause.after) : null;
    if (b) before.setLngLat(b).addTo(map);
    else before.remove();
    if (a) after.setLngLat(a).addTo(map);
    else after.remove();
  }

  // Frame the active pause (route + a little padding); fall back to the whole
  // track when there is no active pause.
  function focusActive() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const coords =
      activePause && route.length >= 2
        ? route.map((p) => [p.lon, p.lat] as [number, number])
        : trackCoords(points);
    if (coords.length < 1) return;
    const bounds = coords.reduce(
      (acc, c) => acc.extend(c),
      new maplibregl.LngLatBounds(coords[0]!, coords[0]!),
    );
    map.fitBounds(bounds, {
      padding: 90,
      maxZoom: 16,
      duration: prefersReducedMotion() || !initialFitRef.current ? 0 : 650,
    });
    initialFitRef.current = true;
  }

  useEffect(() => {
    sync();
    syncPins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, pauses, pauseStatuses, activePause, route, previewRecords]);

  // Re-frame only when the *active pause* changes (not while drawing).
  useEffect(() => {
    focusActive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePause?.id]);

  // Crosshair cursor while drawing.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    map.getCanvas().style.cursor = drawing ? 'crosshair' : '';
  }, [drawing]);

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />;
}
