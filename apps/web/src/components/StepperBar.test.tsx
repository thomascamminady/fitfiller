import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepperBar } from './StepperBar';
import { makeActivity } from '../test/fixtures';
import { pauseStatus, type PauseStatus } from '../pauseStatus';

function setup(activeIndex: number) {
  const { pauses } = makeActivity(3);
  const statuses: Record<string, PauseStatus> = Object.fromEntries(
    pauses.map((p) => [p.id, pauseStatus(p, false)]),
  );
  const onSelect = vi.fn();
  render(
    <StepperBar
      pauses={pauses}
      statuses={statuses}
      activeIndex={activeIndex}
      onSelect={onSelect}
    />,
  );
  return { pauses, onSelect };
}

describe('StepperBar', () => {
  it('renders nothing in the overview state', () => {
    const { container } = render(
      <StepperBar
        pauses={makeActivity(2).pauses}
        statuses={{}}
        activeIndex={-1}
        onSelect={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows the current position and a node per pause', () => {
    setup(1);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/of 3/)).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('advances with the next arrow', async () => {
    const { onSelect } = setup(0);
    await userEvent.click(screen.getByRole('button', { name: /next pause/i }));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('disables next on the last pause', () => {
    setup(2);
    expect(screen.getByRole('button', { name: /next pause/i })).toBeDisabled();
  });

  it('steps back to the overview from the first pause', async () => {
    const { onSelect } = setup(0);
    await userEvent.click(
      screen.getByRole('button', { name: /previous pause/i }),
    );
    expect(onSelect).toHaveBeenCalledWith(-1);
  });
});
