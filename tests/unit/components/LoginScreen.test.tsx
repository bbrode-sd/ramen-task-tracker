import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Mock contexts
const mockSignInWithGoogle = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    signInWithGoogle: mockSignInWithGoogle,
    loading: false,
  }),
}));

vi.mock('@/contexts/LocaleContext', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'app.title': 'Tomobodo',
        'app.description': 'Your bilingual task management app',
        'auth.signInWithGoogle': 'Sign in with Google',
        'auth.secureAuth': 'Secure Authentication',
        'login.features.dragDrop': 'Drag and drop',
        'login.features.bilingual': 'Bilingual support',
        'login.features.comments': 'Comments',
        'login.features.archive': 'Archive',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}));

import { LoginScreen } from '@/components/LoginScreen';

describe('LoginScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the app title', () => {
    render(<LoginScreen />);

    expect(screen.getByText('Tomobodo')).toBeInTheDocument();
  });

  it('should render the app description', () => {
    render(<LoginScreen />);

    expect(screen.getByText('Your bilingual task management app')).toBeInTheDocument();
  });

  it('should render sign in with Google button', () => {
    render(<LoginScreen />);

    expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
  });

  it('should call signInWithGoogle when button is clicked', async () => {
    const user = userEvent.setup();
    
    render(<LoginScreen />);

    await user.click(screen.getByText('Sign in with Google'));

    expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('should render feature list', () => {
    render(<LoginScreen />);

    expect(screen.getByText('Drag and drop')).toBeInTheDocument();
    expect(screen.getByText('Bilingual support')).toBeInTheDocument();
    expect(screen.getByText('Comments')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
  });

  it('should render secure auth badge', () => {
    render(<LoginScreen />);

    expect(screen.getByText('Secure Authentication')).toBeInTheDocument();
  });

  it('should render privacy and terms links', () => {
    render(<LoginScreen />);

    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    expect(screen.getByText('Terms of Service')).toBeInTheDocument();
  });

  it('should have correct href for privacy link', () => {
    render(<LoginScreen />);

    const privacyLink = screen.getByText('Privacy Policy');
    expect(privacyLink).toHaveAttribute('href', '/privacy');
  });

  it('should have correct href for terms link', () => {
    render(<LoginScreen />);

    const termsLink = screen.getByText('Terms of Service');
    expect(termsLink).toHaveAttribute('href', '/terms');
  });

  it('should render logo image', () => {
    render(<LoginScreen />);

    const logos = screen.getAllByAltText('Tomobodo');
    expect(logos.length).toBeGreaterThan(0);
  });
});

describe('LoginScreen - Structure', () => {
  it('should have proper document structure with main content', () => {
    render(<LoginScreen />);

    // Verify the login screen has main content areas
    expect(screen.getByText('Tomobodo')).toBeInTheDocument();
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
  });
});
