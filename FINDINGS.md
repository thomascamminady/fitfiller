# fitfiller — audit (what's missing / broken / improvable)

Status legend: ✅ fixed this pass · 📝 documented as a known limitation.

## Bugs

1. ✅ **Upload size limit crashes.** `file.toBuffer()` in the upload route was
   outside the try/catch, so an over-limit file threw an unhandled error (500)
   instead of a clean 413.
2. ✅ **Fabricated distance for GPS-only-no-distance files.** Gap fill used
   `before.distance ?? 0`, inventing a `0` baseline when a record had no
   `distance` field — producing non-monotonic distances. Now synthetic records
   leave `distance` null when the source has none.
3. ✅ **Modals weren't keyboard-dismissable.** Added Escape-to-close + initial
   focus to all overlays (a11y).

## Missing (vs the spec / expectations)

4. ✅ **Laps were never imported.** The README asks for "lap and pause/unpause
   data". Pause/unpause was done; laps were decoded by the SDK but dropped.
   Now decoded into the domain model, counted in the summary, and drawn as
   divider ticks on the heart-rate chart.
5. ✅ **No manual value for HR/cadence.** Core supported a `value` fill mode but
   the UI only offered "Leave empty"/"Average". Added a "Set value" option with
   a numeric input.
6. ✅ **Premium elevation did nothing by default.** `ELEVATION_PROVIDER`
   defaulted to `none`, so even premium users got linear interpolation. Now
   defaults to OpenTopoData (free, no key); failures fall back to linear so it
   never breaks.

## Improvements

7. ✅ **Live preview.** Previously you had to click "Preview" to see the fill on
   the map/chart. Enabling a gap (or editing its route/options) now auto-previews
   (debounced), so the green fill and HR overlay update as you work.
8. ✅ **Chart shows laps + is keyed to the active gap.** Lap boundaries render as
   faint ticks so you can orient in time.
9. ✅ **More tests** — lap decoding, the `value` fill mode, the elevation
   default, and the HR chart.

## Known limitations (documented, not addressed this pass) 📝

- **No persistence.** Activities live in memory with a 1h TTL; a refresh loses
  state. Fine for the demo; swap `ActivityStore` for Redis/DB later.
- **Single session only.** Multisport/multi-session files surface just the first
  session's summary.
- **Route drawing is append-only.** You can add/undo/clear waypoints but not drag
  or insert mid-route.
- **Auth is a single demo user.** The premium store is process-global; real
  per-user auth + Stripe is the next milestone.
- **Grade model is running-specific** (Minetti). Cycling would want a different
  cost curve.
- **No rate limiting / abuse protection** on the API.
