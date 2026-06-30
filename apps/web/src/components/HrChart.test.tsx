import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { HrChart } from './HrChart';
import { makeActivity } from '../test/fixtures';
import type { TrackPoint } from '../types';

const T0 = 1_000_000_000_000;
const pt = (sec: number, hr: number | null): TrackPoint => ({
  time: T0 + sec * 1000,
  lat: 47,
  lon: 8,
  altitude: 100,
  distance: sec * 3,
  speed: 3,
  heartRate: hr,
  cadence: 85,
});

describe('HrChart', () => {
  it('renders an SVG with pause bands and lap ticks', () => {
    const activity = makeActivity(1);
    const points = [pt(0, 150), pt(1, 152), pt(2, 151), pt(60, 158), pt(61, 160)];
    const { container } = render(
      <HrChart
        points={points}
        pauses={activity.pauses}
        pauseStatuses={{}}
        laps={activity.laps}
        activePauseId={activity.pauses[0]!.id}
        filledByPause={{}}
      />,
    );
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelector('.hr-band.active')).toBeTruthy();
    expect(container.querySelectorAll('.hr-lap').length).toBeGreaterThan(0);
    expect(container.querySelector('.hr-line.trace')).toBeTruthy();
  });

  it('renders an elevation panel when altitude is present', () => {
    const activity = makeActivity(1);
    const points = [pt(0, 150), pt(1, 152), pt(60, 158), pt(61, 160)];
    const { container, getByText } = render(
      <HrChart
        points={points}
        pauses={activity.pauses}
        pauseStatuses={{}}
        laps={activity.laps}
        activePauseId={null}
        filledByPause={{}}
      />,
    );
    // Both HR and Elevation panel labels are drawn.
    expect(getByText('HEART RATE')).toBeInTheDocument();
    expect(getByText('ELEVATION')).toBeInTheDocument();
    expect(container.querySelector('.hr-area')).toBeTruthy();
  });

  it('draws a filled overlay when a preview exists', () => {
    const activity = makeActivity(1);
    const points = [pt(0, 150), pt(60, 158)];
    const filled = [pt(20, 154), pt(40, 156)];
    const { container } = render(
      <HrChart
        points={points}
        pauses={activity.pauses}
        pauseStatuses={{}}
        laps={[]}
        activePauseId={null}
        filledByPause={{ [activity.pauses[0]!.id]: filled }}
      />,
    );
    expect(container.querySelector('.hr-line.fill')).toBeTruthy();
  });

  it('shows an empty state with neither heart-rate nor elevation data', () => {
    const blank = (sec: number): TrackPoint => ({ ...pt(sec, null), altitude: null });
    const { getByText } = render(
      <HrChart
        points={[blank(0), blank(1)]}
        pauses={[]}
        pauseStatuses={{}}
        laps={[]}
        activePauseId={null}
        filledByPause={{}}
      />,
    );
    expect(getByText(/no heart-rate or elevation data/i)).toBeInTheDocument();
  });
});
