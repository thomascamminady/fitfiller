import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Landing } from './Landing';

describe('Landing', () => {
  it('renders the hero copy and upload control', () => {
    render(<Landing onFile={() => {}} busy={false} />);
    expect(screen.getByText(/forgot to unpause/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose a \.fit file/i })).toBeInTheDocument();
  });

  it('shows a busy state', () => {
    render(<Landing onFile={() => {}} busy={true} />);
    expect(screen.getByRole('button', { name: /reading file/i })).toBeDisabled();
  });

  it('calls onFile when a file is selected', async () => {
    const onFile = vi.fn();
    const { container } = render(<Landing onFile={onFile} busy={false} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([1, 2, 3])], 'run.fit');
    await userEvent.upload(input, file);
    expect(onFile).toHaveBeenCalledWith(file);
  });
});
