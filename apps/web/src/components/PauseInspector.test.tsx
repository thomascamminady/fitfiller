import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PauseInspector, type PauseFillState } from './PauseInspector';
import { makeActivity, makeFills } from '../test/fixtures';
import type { AuthContext } from '../types';

const FREE: AuthContext = { userId: 'u', isPremium: false, tier: 'free' };
const PREMIUM: AuthContext = { userId: 'u', isPremium: true, tier: 'premium' };

function renderInspector(
  over: {
    activeIndex?: number;
    fills?: Record<string, PauseFillState>;
    auth?: AuthContext;
  } = {},
) {
  const activity = makeActivity(2);
  const fills = over.fills ?? makeFills(activity);
  const handlers = {
    setActiveIndex: vi.fn(),
    updateFill: vi.fn(),
    setDrawing: vi.fn(),
    onUndoWaypoint: vi.fn(),
    onClearWaypoints: vi.fn(),
    onPreview: vi.fn(),
    onExport: vi.fn(),
  };
  render(
    <PauseInspector
      activity={activity}
      filename="run.fit"
      activeIndex={over.activeIndex ?? 0}
      fills={fills}
      auth={over.auth ?? FREE}
      drawing={false}
      previewBusy={false}
      exportBusy={false}
      {...handlers}
    />,
  );
  return { activity, fills, handlers };
}

describe('PauseInspector', () => {
  it('renders the activity summary including laps', () => {
    renderInspector();
    expect(screen.getByText('Distance')).toBeInTheDocument();
    expect(screen.getByText('5.00 km')).toBeInTheDocument();
    expect(screen.getByText('Laps')).toBeInTheDocument();
    expect(screen.getByText('Pauses found')).toBeInTheDocument();
  });

  it('reveals a numeric input when a fill is set to "Set value"', async () => {
    const activity = makeActivity(2);
    const fills = makeFills(activity);
    fills['pause-0']!.enabled = true;
    const { handlers } = renderInspector({ fills });
    const selects = screen.getAllByRole('combobox');
    // First fill control is heart rate.
    await userEvent.selectOptions(selects[0]!, 'value');
    expect(handlers.updateFill).toHaveBeenCalledWith('pause-0', {
      heartRate: 'value',
    });
  });

  it('shows the overview and starts a review from it', async () => {
    const { handlers } = renderInspector({ activeIndex: -1 });
    expect(screen.getByText(/gaps? to fix/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /review gaps/i }));
    // makePause defaults to a 450 m move → an issue → jump to the first one.
    expect(handlers.setActiveIndex).toHaveBeenCalledWith(0);
  });

  it('enables a fill when the toggle is switched on', async () => {
    const { handlers, activity } = renderInspector();
    // Only the "Fill this gap" switch is visible while disabled.
    await userEvent.click(screen.getByRole('switch'));
    expect(handlers.updateFill).toHaveBeenCalledWith(activity.pauses[0]!.id, {
      enabled: true,
    });
  });

  it('keeps premium switches disabled for free users', () => {
    const activity = makeActivity(2);
    const fills = makeFills(activity);
    fills['pause-0']!.enabled = true; // reveal the premium controls
    renderInspector({ fills, auth: FREE });
    const switches = screen.getAllByRole('switch');
    // fill toggle (enabled) + 2 premium switches (disabled)
    expect(
      switches.filter((s) => (s as HTMLButtonElement).disabled),
    ).toHaveLength(2);
  });

  it('allows premium switches for premium users', () => {
    const activity = makeActivity(2);
    const fills = makeFills(activity);
    fills['pause-0']!.enabled = true;
    renderInspector({ fills, auth: PREMIUM });
    const switches = screen.getAllByRole('switch');
    expect(
      switches.filter((s) => (s as HTMLButtonElement).disabled),
    ).toHaveLength(0);
  });

  it('disables export until at least one gap is enabled', () => {
    renderInspector();
    expect(
      screen.getByRole('button', { name: /export corrected/i }),
    ).toBeDisabled();
  });

  it('exports when a gap is enabled', async () => {
    const activity = makeActivity(2);
    const fills = makeFills(activity);
    fills['pause-0']!.enabled = true;
    const { handlers } = renderInspector({ fills });
    const btn = screen.getByRole('button', { name: /export corrected/i });
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    expect(handlers.onExport).toHaveBeenCalled();
  });

  it('explains when a pause has no GPS', () => {
    const activity = makeActivity(1);
    activity.pauses[0]!.before.lat = null;
    activity.pauses[0]!.before.lon = null;
    const fills = makeFills(activity);
    render(
      <PauseInspector
        activity={activity}
        filename="run.fit"
        activeIndex={0}
        fills={fills}
        auth={FREE}
        drawing={false}
        previewBusy={false}
        exportBusy={false}
        setActiveIndex={vi.fn()}
        updateFill={vi.fn()}
        setDrawing={vi.fn()}
        onUndoWaypoint={vi.fn()}
        onClearWaypoints={vi.fn()}
        onPreview={vi.fn()}
        onExport={vi.fn()}
      />,
    );
    expect(screen.getByText(/no GPS fix/i)).toBeInTheDocument();
  });
});
