import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PremiumModal } from './PremiumModal';
import { ExportReview } from './ExportReview';
import type { ExportSummary } from '../types';

const summary = (ok: boolean): ExportSummary => ({
  ok,
  original: { points: 100, distanceMeters: 2000, durationSeconds: 600, pauses: 1, filledHeartRatePoints: 100 },
  filled: { points: 160, distanceMeters: 3100, durationSeconds: 900, pauses: 0, filledHeartRatePoints: 160 },
  delta: { points: 60, distanceMeters: 1100, durationSeconds: 300, pausesRemoved: 1 },
});

describe('PremiumModal', () => {
  it('subscribes when the CTA is clicked', async () => {
    const onSubscribe = vi.fn();
    render(<PremiumModal onSubscribe={onSubscribe} onClose={() => {}} busy={false} />);
    await userEvent.click(screen.getByRole('button', { name: /go premium/i }));
    expect(onSubscribe).toHaveBeenCalled();
  });

  it('disables the CTA while busy', () => {
    render(<PremiumModal onSubscribe={() => {}} onClose={() => {}} busy={true} />);
    expect(screen.getByRole('button', { name: /activating/i })).toBeDisabled();
  });
});

describe('ExportReview', () => {
  it('shows the diff and verified integrity, and downloads', async () => {
    const onConfirm = vi.fn();
    render(
      <ExportReview summary={summary(true)} onConfirm={onConfirm} onClose={() => {}} busy={false} />,
    );
    expect(screen.getByText(/verified/i)).toBeInTheDocument();
    expect(screen.getByText('3.10 km')).toBeInTheDocument();
    const dl = screen.getByRole('button', { name: /download \.fit/i });
    expect(dl).toBeEnabled();
    await userEvent.click(dl);
    expect(onConfirm).toHaveBeenCalled();
  });

  it('blocks download when the file failed verification', () => {
    render(
      <ExportReview summary={summary(false)} onConfirm={() => {}} onClose={() => {}} busy={false} />,
    );
    expect(screen.getByText(/failed to decode/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download \.fit/i })).toBeDisabled();
  });
});
