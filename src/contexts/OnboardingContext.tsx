'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  action?: string;
}

interface OnboardingContextType {
  isOnboardingActive: boolean;
  currentStepIndex: number;
  currentStep: OnboardingStep | null;
  totalSteps: number;
  hasCompletedOnboarding: boolean;
  isNewUser: boolean;
  startOnboarding: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipOnboarding: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  setIsNewUser: (value: boolean) => void;
  showTips: boolean;
  setShowTips: (value: boolean) => void;
  tipsDismissed: string[];
  dismissTip: (tipId: string) => void;
}

const ONBOARDING_STORAGE_KEY = 'ramen-onboarding-completed';
const TIPS_STORAGE_KEY = 'ramen-tips-dismissed';
const SHOW_TIPS_KEY = 'ramen-show-tips';

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Ramen Task Tracker! 🍜',
    description: 'Let\'s take a quick tour to help you get started with organizing your tasks.',
    position: 'bottom',
  },
  {
    id: 'create-board',
    title: 'Create Your First Board',
    description: 'Boards are where you organize your projects. Click "Create new board" to get started!',
    targetSelector: '[data-onboarding="create-board"]',
    position: 'right',
    action: 'Click to create a board',
  },
  {
    id: 'add-column',
    title: 'Add a Column',
    description: 'Columns represent different stages of your workflow, like "To Do", "In Progress", and "Done".',
    targetSelector: '[data-onboarding="add-column"]',
    position: 'left',
    action: 'Click to add a column',
  },
  {
    id: 'add-card',
    title: 'Add a Card',
    description: 'Cards are your tasks. Add a card to start tracking your work!',
    targetSelector: '[data-onboarding="add-card"]',
    position: 'top',
    action: 'Click to add a card',
  },
  {
    id: 'drag-drop',
    title: 'Drag to Move Cards',
    description: 'Drag cards between columns to update their status. Try it out!',
    targetSelector: '[data-onboarding="card"]',
    position: 'right',
    action: 'Drag to move',
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    description: 'Press "?" anytime to see all keyboard shortcuts. Pro tip: Press "/" to search!',
    position: 'bottom',
  },
  {
    id: 'complete',
    title: 'You\'re All Set! 🎉',
    description: 'You\'re ready to start organizing your tasks. Happy tracking!',
    position: 'bottom',
  },
];

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [isOnboardingActive, setIsOnboardingActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true); // Default true to prevent flash
  const [isNewUser, setIsNewUser] = useState(false);
  const [showTips, setShowTipsState] = useState(true);
  const [tipsDismissed, setTipsDismissed] = useState<string[]>([]);

  // Load state from localStorage on mount
  useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    setHasCompletedOnboarding(completed === 'true');

    const dismissed = localStorage.getItem(TIPS_STORAGE_KEY);
    if (dismissed) {
      try {
        setTipsDismissed(JSON.parse(dismissed));
      } catch {
        setTipsDismissed([]);
      }
    }

    const showTipsStored = localStorage.getItem(SHOW_TIPS_KEY);
    setShowTipsState(showTipsStored !== 'false');
  }, []);

  const currentStep = isOnboardingActive ? ONBOARDING_STEPS[currentStepIndex] : null;

  const startOnboarding = useCallback(() => {
    setCurrentStepIndex(0);
    setIsOnboardingActive(true);
  }, []);

  const nextStep = useCallback(() => {
    if (currentStepIndex < ONBOARDING_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      // Completed all steps
      setIsOnboardingActive(false);
      setHasCompletedOnboarding(true);
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    }
  }, [currentStepIndex]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const skipOnboarding = useCallback(() => {
    setIsOnboardingActive(false);
    setHasCompletedOnboarding(true);
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
  }, []);

  const completeOnboarding = useCallback(() => {
    setIsOnboardingActive(false);
    setHasCompletedOnboarding(true);
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
  }, []);

  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    setHasCompletedOnboarding(false);
    setCurrentStepIndex(0);
  }, []);

  const setShowTips = useCallback((value: boolean) => {
    setShowTipsState(value);
    localStorage.setItem(SHOW_TIPS_KEY, String(value));
  }, []);

  const dismissTip = useCallback((tipId: string) => {
    setTipsDismissed((prev) => {
      const updated = [...prev, tipId];
      localStorage.setItem(TIPS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        isOnboardingActive,
        currentStepIndex,
        currentStep,
        totalSteps: ONBOARDING_STEPS.length,
        hasCompletedOnboarding,
        isNewUser,
        startOnboarding,
        nextStep,
        prevStep,
        skipOnboarding,
        completeOnboarding,
        resetOnboarding,
        setIsNewUser,
        showTips,
        setShowTips,
        tipsDismissed,
        dismissTip,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
