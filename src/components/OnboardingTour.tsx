'use client';

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOnboarding, OnboardingStep } from '@/contexts/OnboardingContext';

interface TooltipPosition {
  top: number;
  left: number;
  arrowPosition: 'top' | 'bottom' | 'left' | 'right';
}

function OnboardingTooltip({
  step,
  stepNumber,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
}: {
  step: OnboardingStep;
  stepNumber: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  const [position, setPosition] = useState<TooltipPosition>({ top: 0, left: 0, arrowPosition: 'top' });
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const calculatePosition = () => {
      if (!step.targetSelector) {
        // Center the tooltip on screen
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        setPosition({
          top: viewportHeight / 2 - 100,
          left: viewportWidth / 2 - 175,
          arrowPosition: 'top',
        });
        setIsVisible(true);
        return;
      }

      const target = document.querySelector(step.targetSelector);
      if (!target) {
        // Target not found, center on screen
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        setPosition({
          top: viewportHeight / 2 - 100,
          left: viewportWidth / 2 - 175,
          arrowPosition: 'top',
        });
        setIsVisible(true);
        return;
      }

      const rect = target.getBoundingClientRect();
      const tooltipWidth = 350;
      const tooltipHeight = 200;
      const margin = 12;

      let top = 0;
      let left = 0;
      let arrowPosition: 'top' | 'bottom' | 'left' | 'right' = 'top';

      switch (step.position) {
        case 'bottom':
          top = rect.bottom + margin;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          arrowPosition = 'top';
          break;
        case 'top':
          top = rect.top - tooltipHeight - margin;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          arrowPosition = 'bottom';
          break;
        case 'left':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.left - tooltipWidth - margin;
          arrowPosition = 'right';
          break;
        case 'right':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.right + margin;
          arrowPosition = 'left';
          break;
        default:
          top = rect.bottom + margin;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          arrowPosition = 'top';
      }

      // Keep tooltip in viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (left < 10) left = 10;
      if (left + tooltipWidth > viewportWidth - 10) left = viewportWidth - tooltipWidth - 10;
      if (top < 10) top = 10;
      if (top + tooltipHeight > viewportHeight - 10) top = viewportHeight - tooltipHeight - 10;

      setPosition({ top, left, arrowPosition });
      setIsVisible(true);
    };

    calculatePosition();
    window.addEventListener('resize', calculatePosition);
    window.addEventListener('scroll', calculatePosition);

    return () => {
      window.removeEventListener('resize', calculatePosition);
      window.removeEventListener('scroll', calculatePosition);
    };
  }, [step]);

  const isFirstStep = stepNumber === 1;
  const isLastStep = stepNumber === totalSteps;

  const arrowStyles: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-[var(--surface)]',
    bottom: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-[var(--surface)]',
    left: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-[var(--surface)]',
    right: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-[var(--surface)]',
  };

  return (
    <div
      ref={tooltipRef}
      className={`fixed z-[100] w-[350px] bg-[var(--surface)] rounded-2xl shadow-2xl border border-[var(--border)] overflow-hidden transition-all duration-300 ${
        isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      {/* Arrow */}
      <div
        className={`absolute w-0 h-0 border-8 ${arrowStyles[position.arrowPosition]}`}
      />

      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🍜</span>
            <span className="text-white/80 text-sm font-medium">
              Step {stepNumber} of {totalSteps}
            </span>
          </div>
          <button
            onClick={onSkip}
            className="text-white/70 hover:text-white text-sm font-medium transition-colors"
          >
            Skip tour
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4">
        <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">{step.title}</h3>
        <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-4">{step.description}</p>

        {step.action && (
          <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 dark:bg-orange-900/30 rounded-lg border border-orange-100 dark:border-orange-800 mb-4">
            <span className="text-orange-500">👆</span>
            <span className="text-sm text-orange-700 dark:text-orange-300 font-medium">{step.action}</span>
          </div>
        )}

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i + 1 === stepNumber
                  ? 'w-6 bg-orange-500'
                  : i + 1 < stepNumber
                  ? 'w-1.5 bg-orange-300'
                  : 'w-1.5 bg-[var(--border)]'
              }`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={onPrev}
            disabled={isFirstStep}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${
              isFirstStep
                ? 'text-[var(--text-muted)] cursor-not-allowed'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            ← Back
          </button>

          <button
            onClick={onNext}
            className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-sm font-medium rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
          >
            {isLastStep ? 'Get Started! 🚀' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}

function HighlightOverlay({ targetSelector }: { targetSelector?: string }) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!targetSelector) {
      setTargetRect(null);
      return;
    }

    const updateRect = () => {
      const target = document.querySelector(targetSelector);
      if (target) {
        setTargetRect(target.getBoundingClientRect());
      }
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect);

    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect);
    };
  }, [targetSelector]);

  if (!targetRect) {
    // Full overlay without highlight
    return (
      <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm transition-opacity duration-300" />
    );
  }

  // Overlay with cutout for target
  const padding = 8;
  const borderRadius = 12;

  return (
    <>
      {/* Dark overlay with cutout */}
      <div
        className="fixed inset-0 z-[90] transition-opacity duration-300"
        style={{
          background: `
            linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)),
            linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0))
          `,
          mask: `
            linear-gradient(#fff, #fff),
            linear-gradient(#fff, #fff)
          `,
          maskComposite: 'exclude',
          WebkitMaskComposite: 'xor',
        }}
      />
      
      {/* Simple overlay approach */}
      <svg className="fixed inset-0 z-[90] w-full h-full pointer-events-none">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={targetRect.left - padding}
              y={targetRect.top - padding}
              width={targetRect.width + padding * 2}
              height={targetRect.height + padding * 2}
              rx={borderRadius}
              ry={borderRadius}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.5)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Highlight ring around target */}
      <div
        className="fixed z-[91] pointer-events-none rounded-xl ring-4 ring-orange-400/60 ring-offset-4 ring-offset-transparent animate-pulse"
        style={{
          top: targetRect.top - padding,
          left: targetRect.left - padding,
          width: targetRect.width + padding * 2,
          height: targetRect.height + padding * 2,
        }}
      />
    </>
  );
}

export function OnboardingTour() {
  const {
    isOnboardingActive,
    currentStep,
    currentStepIndex,
    totalSteps,
    nextStep,
    prevStep,
    skipOnboarding,
  } = useOnboarding();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isOnboardingActive || !currentStep) {
    return null;
  }

  return createPortal(
    <>
      <HighlightOverlay targetSelector={currentStep.targetSelector} />
      <OnboardingTooltip
        step={currentStep}
        stepNumber={currentStepIndex + 1}
        totalSteps={totalSteps}
        onNext={nextStep}
        onPrev={prevStep}
        onSkip={skipOnboarding}
      />
    </>,
    document.body
  );
}

// Replay Tour button component for settings/header
export function ReplayTourButton({ className = '' }: { className?: string }) {
  const { resetOnboarding, startOnboarding } = useOnboarding();

  const handleReplay = () => {
    resetOnboarding();
    startOnboarding();
  };

  return (
    <button
      onClick={handleReplay}
      className={`flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-xl transition-all ${className}`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
      Replay Tour
    </button>
  );
}
