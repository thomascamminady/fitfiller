import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeActivity } from './test/fixtures';

// MapView pulls in MapLibre/WebGL, which jsdom can't run — stub it.
vi.mock('./components/MapView', () => ({
  MapView: () => <div data-testid="map" />,
}));

// Control the API surface.
vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return {
    ...actual,
    api: {
      upload: vi.fn(),
      previewFill: vi.fn(),
      exportSummary: vi.fn(),
      export: vi.fn(),
    },
  };
});

import { App } from './App';
import { api } from './api';

const mockedApi = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('App', () => {
  it('shows the landing page with author attribution in the footer', async () => {
    render(<App />);
    expect(screen.getByText(/fix your \.fit file/i)).toBeInTheDocument();
    expect(screen.getByText(/by thomas camminady/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /camminady on github/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /camminady on linkedin/i }),
    ).toBeInTheDocument();
  });

  it('opens the Impressum modal from the footer', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Impressum' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Impressum' }),
    ).toBeInTheDocument();
  });

  it('moves to the editor after a successful upload', async () => {
    const activity = makeActivity(1);
    mockedApi.upload.mockResolvedValue({
      id: 'a1',
      filename: 'run.fit',
      activity,
    });

    const { container } = render(<App />);
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await userEvent.upload(input, new File([new Uint8Array([1])], 'run.fit'));

    await waitFor(() => expect(screen.getByTestId('map')).toBeInTheDocument());
    // Lands on the overview (whole file) before stepping into a gap.
    expect(
      screen.getByRole('button', { name: /review gaps/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /new file/i }),
    ).toBeInTheDocument();
  });
});
