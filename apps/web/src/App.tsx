import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from './api';
import type {
  ExportSummary,
  FillRequest,
  GeoPoint,
  TrackPoint,
  UploadResponse,
} from './types';
import { TopBar } from './components/TopBar';
import { Footer } from './components/Footer';
import { Landing } from './components/Landing';
import { MapView } from './components/MapView';
import { StepperBar } from './components/StepperBar';
import { HrChart } from './components/HrChart';
import {
  PauseInspector,
  type PauseFillState,
} from './components/PauseInspector';
import { Legal, type LegalPage } from './components/Legal';
import { ExportReview } from './components/ExportReview';
import { pauseStatus, type PauseStatus } from './pauseStatus';

function defaultFill(): PauseFillState {
  return {
    enabled: false,
    waypoints: [],
    actualBreakSeconds: 0,
    heartRate: 'average',
    heartRateValue: 150,
    cadence: 'average',
    cadenceValue: 85,
    elevation: 'linear',
    gradeAdjust: false,
    snapToPath: false,
    preview: null,
    previewError: null,
  };
}

interface Toast {
  message: string;
  error?: boolean;
}

export function App() {
  const [upload, setUpload] = useState<UploadResponse | null>(null);
  const [fills, setFills] = useState<Record<string, PauseFillState>>({});
  // -1 = overview: show the whole file before stepping into individual gaps.
  const [activeIndex, setActiveIndex] = useState(-1);
  const [drawing, setDrawing] = useState(false);

  const [uploadBusy, setUploadBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);

  const [legal, setLegal] = useState<LegalPage | null>(null);
  const [exportSummary, setExportSummary] = useState<ExportSummary | null>(
    null,
  );
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Esc finishes drawing — a familiar "I'm done" gesture.
  useEffect(() => {
    if (!drawing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawing(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawing]);

  const pauses = upload?.activity.pauses ?? [];
  const activePause = pauses[activeIndex] ?? null;
  const activeFill = activePause ? fills[activePause.id] : undefined;

  const activeRoute = useMemo<GeoPoint[]>(() => {
    if (!activePause || activePause.before.lat === null) return [];
    const { before, after } = activePause;
    return [
      { lat: before.lat!, lon: before.lon! },
      ...(activeFill?.waypoints ?? []),
      { lat: after.lat!, lon: after.lon! },
    ];
  }, [activePause, activeFill?.waypoints]);

  const pauseStatuses = useMemo<Record<string, PauseStatus>>(() => {
    const out: Record<string, PauseStatus> = {};
    for (const p of pauses)
      out[p.id] = pauseStatus(p, fills[p.id]?.enabled ?? false);
    return out;
  }, [pauses, fills]);

  // Filled HR records per pause, for the chart overlay.
  const filledByPause = useMemo<Record<string, TrackPoint[]>>(() => {
    const out: Record<string, TrackPoint[]> = {};
    for (const [id, f] of Object.entries(fills)) {
      if (f.preview) out[id] = f.preview.records;
    }
    return out;
  }, [fills]);

  const handleFile = useCallback(async (file: File) => {
    setUploadBusy(true);
    try {
      const res = await api.upload(file);
      setUpload(res);
      setFills(
        Object.fromEntries(
          res.activity.pauses.map((p) => [p.id, defaultFill()]),
        ),
      );
      setActiveIndex(-1); // land on the overview, not the first gap
      setDrawing(false);
    } catch (err) {
      setToast({ message: errMessage(err), error: true });
    } finally {
      setUploadBusy(false);
    }
  }, []);

  const updateFill = useCallback(
    (pauseId: string, patch: Partial<PauseFillState>) => {
      setFills((prev) => {
        const next = { ...prev[pauseId]!, ...patch };
        if (!('preview' in patch)) {
          next.preview = null;
          next.previewError = null;
        }
        return { ...prev, [pauseId]: next };
      });
    },
    [],
  );

  const addWaypoint = useCallback(
    (p: GeoPoint) => {
      if (!activePause) return;
      setFills((prev) => {
        const cur = prev[activePause.id]!;
        return {
          ...prev,
          [activePause.id]: {
            ...cur,
            waypoints: [...cur.waypoints, p],
            preview: null,
            previewError: null,
          },
        };
      });
    },
    [activePause],
  );

  const undoWaypoint = useCallback((pauseId: string) => {
    setFills((prev) => {
      const cur = prev[pauseId]!;
      return {
        ...prev,
        [pauseId]: {
          ...cur,
          waypoints: cur.waypoints.slice(0, -1),
          preview: null,
        },
      };
    });
  }, []);

  const clearWaypoints = useCallback((pauseId: string) => {
    setFills((prev) => ({
      ...prev,
      [pauseId]: { ...prev[pauseId]!, waypoints: [], preview: null },
    }));
  }, []);

  const buildRequest = useCallback(
    (pauseId: string): FillRequest => {
      const pause = pauses.find((p) => p.id === pauseId)!;
      const f = fills[pauseId]!;
      const route: GeoPoint[] = [
        { lat: pause.before.lat!, lon: pause.before.lon! },
        ...f.waypoints,
        { lat: pause.after.lat!, lon: pause.after.lon! },
      ];
      return {
        pauseId,
        route,
        config: {
          actualBreakSeconds: f.actualBreakSeconds,
          heartRate: { mode: f.heartRate, value: f.heartRateValue },
          cadence: { mode: f.cadence, value: f.cadenceValue },
          elevation: { mode: f.elevation },
          gradeAdjust: f.gradeAdjust,
          snapToPath: f.snapToPath,
        },
      };
    },
    [pauses, fills],
  );

  const handlePreview = useCallback(
    async (pauseId: string) => {
      if (!upload) return;
      setPreviewBusy(true);
      try {
        const fill = await api.previewFill(upload.id, buildRequest(pauseId));
        updateFill(pauseId, { preview: fill, previewError: null });
      } catch (err) {
        updateFill(pauseId, { preview: null, previewError: errMessage(err) });
      } finally {
        setPreviewBusy(false);
      }
    },
    [upload, buildRequest, updateFill],
  );

  // Live preview: once a gap is enabled (and whenever its route/options change)
  // recompute the fill automatically so the map and chart update as you work.
  useEffect(() => {
    if (!upload || !activePause) return;
    const f = fills[activePause.id];
    if (!f || !f.enabled || f.preview || f.previewError) return;
    if (activeRoute.length < 2) return;
    const t = setTimeout(() => {
      void handlePreview(activePause.id);
    }, 450);
    return () => clearTimeout(t);
  }, [upload, activePause, fills, activeRoute, handlePreview]);

  const enabledRequests = useCallback(
    () =>
      pauses.filter((p) => fills[p.id]?.enabled).map((p) => buildRequest(p.id)),
    [pauses, fills, buildRequest],
  );

  // Step 1: compute and show the before/after diff + integrity check.
  const handleReview = useCallback(async () => {
    if (!upload) return;
    const requests = enabledRequests();
    if (requests.length === 0) return;
    setSummaryBusy(true);
    try {
      const summary = await api.exportSummary(upload.id, requests);
      setExportSummary(summary);
    } catch (err) {
      setToast({ message: errMessage(err), error: true });
    } finally {
      setSummaryBusy(false);
    }
  }, [upload, enabledRequests]);

  // Step 2: actually build and download the file.
  const handleDownload = useCallback(async () => {
    if (!upload) return;
    setDownloadBusy(true);
    try {
      const blob = await api.export(upload.id, enabledRequests());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = upload.filename.replace(/\.fit$/i, '') + '-fit-filler.fit';
      a.click();
      URL.revokeObjectURL(url);
      setExportSummary(null);
      setToast({ message: 'Done — your corrected .fit was downloaded.' });
    } catch (err) {
      setToast({ message: errMessage(err), error: true });
    } finally {
      setDownloadBusy(false);
    }
  }, [upload, enabledRequests]);

  const reset = useCallback(() => {
    setUpload(null);
    setFills({});
    setActiveIndex(-1);
    setDrawing(false);
  }, []);

  return (
    <div className="app">
      <TopBar onReset={reset} hasActivity={!!upload} />

      {!upload ? (
        <Landing onFile={handleFile} busy={uploadBusy} />
      ) : (
        <div className="editor">
          <PauseInspector
            activity={upload.activity}
            filename={upload.filename}
            activeIndex={activeIndex}
            setActiveIndex={(i) => {
              setActiveIndex(i);
              setDrawing(false);
            }}
            fills={fills}
            updateFill={updateFill}
            drawing={drawing}
            setDrawing={setDrawing}
            onUndoWaypoint={undoWaypoint}
            onClearWaypoints={clearWaypoints}
            onPreview={handlePreview}
            previewBusy={previewBusy}
            onExport={handleReview}
            exportBusy={summaryBusy}
          />

          <div className="map-col">
            <div className="map-pane">
              <MapView
                points={upload.activity.points}
                pauses={pauses}
                pauseStatuses={pauseStatuses}
                activePause={activePause}
                route={activeRoute}
                previewRecords={activeFill?.preview?.records ?? null}
                drawing={drawing}
                onAddWaypoint={addWaypoint}
              />
              {activePause && (
                <div
                  className={`map-status-wash tone-${pauseStatuses[activePause.id] ?? 'break'}`}
                  aria-hidden="true"
                />
              )}
              {!drawing && (
                <StepperBar
                  pauses={pauses}
                  statuses={pauseStatuses}
                  activeIndex={activeIndex}
                  onSelect={(i) => {
                    setActiveIndex(i);
                    setDrawing(false);
                  }}
                />
              )}
              <div className="map-legend">
                <div className="legend-row">
                  <span className="swatch trace" /> Recorded track
                </div>
                <div className="legend-row">
                  <span className="dot-swatch pause" /> Paused
                  <span className="dot-swatch resume" /> Resumed
                </div>
                <div className="legend-row">
                  <span className="swatch route" /> Filled route
                </div>
              </div>
            </div>
            <HrChart
              points={upload.activity.points}
              pauses={pauses}
              pauseStatuses={pauseStatuses}
              laps={upload.activity.laps}
              activePauseId={activePause?.id ?? null}
              filledByPause={filledByPause}
            />
          </div>
        </div>
      )}

      <Footer onOpen={setLegal} />
      {legal && <Legal page={legal} onClose={() => setLegal(null)} />}
      {exportSummary && (
        <ExportReview
          summary={exportSummary}
          onConfirm={handleDownload}
          onClose={() => setExportSummary(null)}
          busy={downloadBusy}
        />
      )}
      {toast && (
        <div className={`toast ${toast.error ? 'error' : ''}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

function errMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return err instanceof Error ? err.message : 'Something went wrong';
}
