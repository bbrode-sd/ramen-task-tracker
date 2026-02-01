import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock OnboardingContext
vi.mock('@/contexts/OnboardingContext', () => ({
  useOnboarding: () => ({
    showTips: true,
    tipsDismissed: [],
    dismissTip: vi.fn(),
  }),
}));

import { Tooltip, Tip, ShortcutHint } from '@/components/Tooltip';

describe('Tooltip Component', () => {
  it('should render children', () => {
    render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>
    );

    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });

  it('should show tooltip content on hover', async () => {
    render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>
    );

    fireEvent.mouseEnter(screen.getByText('Hover me'));

    await waitFor(() => {
      expect(screen.getByText('Tooltip text')).toBeInTheDocument();
    });
  });

  it('should hide tooltip on mouse leave', async () => {
    render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>
    );

    fireEvent.mouseEnter(screen.getByText('Hover me'));
    
    await waitFor(() => {
      expect(screen.getByText('Tooltip text')).toBeInTheDocument();
    });

    fireEvent.mouseLeave(screen.getByText('Hover me'));

    await waitFor(() => {
      expect(screen.queryByText('Tooltip text')).not.toBeInTheDocument();
    });
  });
});

describe('Tip Component', () => {
  it('should render children', () => {
    render(
      <Tip id="test-tip" tip="Tip text">
        <button>Button with tip</button>
      </Tip>
    );

    expect(screen.getByText('Button with tip')).toBeInTheDocument();
  });

  it('should show tip with shortcut', async () => {
    render(
      <Tip id="test-tip" tip="Press this key" shortcut="?">
        <button>Help</button>
      </Tip>
    );

    fireEvent.mouseEnter(screen.getByText('Help'));

    await waitFor(() => {
      expect(screen.getByText('Press this key')).toBeInTheDocument();
    });
  });
});

describe('ShortcutHint Component', () => {
  it('should render shortcut and label', () => {
    render(<ShortcutHint shortcut="/" label="Search" />);

    expect(screen.getByText('/')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
  });

  it('should render without label', () => {
    render(<ShortcutHint shortcut="?" />);

    expect(screen.getByText('?')).toBeInTheDocument();
  });
});
