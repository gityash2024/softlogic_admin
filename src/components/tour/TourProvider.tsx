import React, { createContext, useContext, ReactNode, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/lib/auth-store';
import { getTourStepsForProfile, AppTourStep, TourProfile } from '@/lib/tour-steps';
import { FloatingTourTrigger } from './FloatingTourTrigger';

interface TourContextValue {
  startTour: (profile?: TourProfile) => void;
}

const TourContext = createContext<TourContextValue | undefined>(undefined);

export function useTour() {
  const context = useContext(TourContext);
  if (context === undefined) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}

interface TourProviderProps {
  children: ReactNode;
}

interface RectCoords {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

export function TourProvider({ children }: TourProviderProps) {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const location = useLocation();

  const [active, setActive] = useState(false);
  const [steps, setSteps] = useState<AppTourStep[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<RectCoords | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navRef = useRef<number>(-1);

  useEffect(() => {
    if (user) {
      const hasSeen = localStorage.getItem(`hasSeenTour_${user.id}`);
      if (!hasSeen) {
        const initialSteps = getTourStepsForProfile('initial', user.role);
        setSteps(initialSteps);
        
        if (location.pathname !== '/dashboard') {
          navigate('/dashboard');
        }
        setTimeout(() => {
          setStepIndex(0);
          setActive(true);
        }, 800);
      }
    }
  }, [user]);

  const startTour = useCallback((profile: TourProfile = 'initial') => {
    if (!user) return;
    
    const newSteps = getTourStepsForProfile(profile, user.role);
    if (newSteps.length === 0) return;
    
    setSteps(newSteps);
    
    const firstRoute = newSteps[0].route;
    if (firstRoute && location.pathname !== firstRoute) {
      navigate(firstRoute);
    }
    
    setTimeout(() => {
      setStepIndex(0);
      setActive(true);
    }, 400);
  }, [user, location.pathname, navigate]);

  const currentStep = active && steps[stepIndex] ? steps[stepIndex] : null;

  useEffect(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    if (!currentStep) {
      setTargetRect(null);
      return;
    }

    if (currentStep.route && location.pathname !== currentStep.route) {
      if (navRef.current !== stepIndex) {
        navRef.current = stepIndex;
        setTargetRect(null);
        navigate(currentStep.route);
        return;
      }
    } else {
      navRef.current = stepIndex;
    }

    if (currentStep.preActionEvent) {
      window.dispatchEvent(new CustomEvent(currentStep.preActionEvent));
    }

    const forcePreActions = !!currentStep.preActionForce;
    const selectorsToClick = currentStep.preActionSelectors 
      ? [...currentStep.preActionSelectors] 
      : (currentStep.preActionSelector ? [currentStep.preActionSelector] : []);

    let actionIndex = 0;
    let attempts = 0;
    let partnerSwitches = 0;

    const isVisible = (el: Element | null) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const findElement = () => {
      try {
        if (actionIndex < selectorsToClick.length) {
          const targetEl = document.querySelector(currentStep.target);
          if (forcePreActions || !isVisible(targetEl)) {
            const selector = selectorsToClick[actionIndex];
            const actionBtn = document.querySelector(selector) as HTMLElement;
            if (actionBtn && !(actionBtn as HTMLButtonElement).disabled && !actionBtn.hasAttribute('disabled') && !actionBtn.closest(':disabled')) {
              actionBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
              actionBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
              actionBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
              actionBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
              actionBtn.click();
              
              actionIndex++;
              attempts = 0;
              partnerSwitches = 0;
            } else {
              attempts++;
              // If disabled/loading for 2 seconds, try selecting the next organization
              if (attempts === 20 && partnerSwitches < 10) {
                window.dispatchEvent(new CustomEvent('tour-action-select-next-org'));
                partnerSwitches++;
                attempts = 0; // Wait for the new org to load
              } else if (attempts >= 50) { // Wait up to 5 seconds
                actionIndex++;
                attempts = 0;
                partnerSwitches = 0;
              }
            }
            return false;
          } else {
            actionIndex = selectorsToClick.length;
          }
        }

        const el = document.querySelector(currentStep.target);
        if (el) {
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const rect = el.getBoundingClientRect();
          setTargetRect({
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            bottom: rect.bottom,
            right: rect.right,
          });
          return true;
        }
      
      attempts += 1;
      if (attempts >= 20) {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        setTargetRect(null);
      }
      return false;
      } catch (err) {
        console.error('Tour pre-action error:', err);
        return false;
      }
    };

    if (!findElement()) {
      pollTimerRef.current = setInterval(findElement, 100);
    }

    const updatePosition = () => {
      const el = document.querySelector(currentStep.target);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          bottom: rect.bottom,
          right: rect.right,
        });
      }
    };

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [currentStep, location.pathname, navigate]);

  const handleNext = () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex((prev) => prev + 1);
    } else {
      handleDone();
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex((prev) => prev - 1);
    }
  };

  const handleDone = () => {
    setActive(false);
    setStepIndex(0);
    setTargetRect(null);
    if (user) {
      localStorage.setItem(`hasSeenTour_${user.id}`, 'true');
    }
  };

  const stepNumber = stepIndex + 1;
  const totalSteps = steps.length;

  const tourContextValue = useMemo(() => ({ startTour }), [startTour]);

  return (
    <TourContext.Provider value={tourContextValue}>
      {children}
      {user && <FloatingTourTrigger />}
      {active &&
        currentStep &&
        createPortal(
          <CustomTourOverlay
            step={currentStep}
            stepNumber={stepNumber}
            totalSteps={totalSteps}
            targetRect={targetRect}
            onNext={handleNext}
            onBack={handleBack}
            onSkip={handleDone}
          />,
          document.body
        )}
    </TourContext.Provider>
  );
}

interface CustomTourOverlayProps {
  step: AppTourStep;
  stepNumber: number;
  totalSteps: number;
  targetRect: RectCoords | null;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

function CustomTourOverlay({
  step,
  stepNumber,
  totalSteps,
  targetRect,
  onNext,
  onBack,
  onSkip,
}: CustomTourOverlayProps) {
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  const pad = 8;
  const spotlight = targetRect
    ? {
        x: Math.max(0, targetRect.left - pad),
        y: Math.max(0, targetRect.top - pad),
        w: targetRect.width + pad * 2,
        h: targetRect.height + pad * 2,
      }
    : null;

  const cardWidth = Math.min(390, windowWidth - 32);
  let cardTop = windowHeight / 2 - 140;
  let cardLeft = windowWidth / 2 - cardWidth / 2;

  if (spotlight) {
    const spotCenterX = spotlight.x + spotlight.w / 2;
    cardLeft = Math.max(16, Math.min(windowWidth - cardWidth - 16, spotCenterX - cardWidth / 2));

    const spaceBelow = windowHeight - (spotlight.y + spotlight.h);
    
    if (spaceBelow >= 260 || (step.placement === 'bottom' && spaceBelow > 200)) {
      cardTop = Math.min(windowHeight - 260, spotlight.y + spotlight.h + 16);
    } else {
      cardTop = Math.max(16, spotlight.y - 260);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        pointerEvents: 'auto',
      }}
    >
      <svg
        width="100%"
        height="100%"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
        }}
      >
        <defs>
          <mask id="tour-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spotlight && (
              <rect
                x={spotlight.x}
                y={spotlight.y}
                width={spotlight.w}
                height={spotlight.h}
                rx="16"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="#061B3A"
          fillOpacity="0.72"
          mask="url(#tour-spotlight-mask)"
        />
      </svg>

      {spotlight && (
        <div
          style={{
            position: 'absolute',
            left: spotlight.x,
            top: spotlight.y,
            width: spotlight.w,
            height: spotlight.h,
            borderRadius: 16,
            boxShadow:
              '0 0 0 3px rgba(255, 255, 255, 0.96), 0 0 0 6px rgba(11, 78, 162, 0.96)',
            pointerEvents: 'none',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      )}

      <div
        style={{
          position: 'absolute',
          top: cardTop,
          left: cardLeft,
          width: cardWidth,
          padding: '18px 20px',
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          border: '1px solid #BFD7FF',
          boxShadow: '0 16px 30px rgba(11, 78, 162, 0.22)',
          fontFamily: "'Inter', system-ui, sans-serif",
          boxSizing: 'border-box',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              backgroundColor: '#FFF3E8',
              border: '1px solid rgba(255, 122, 26, 0.28)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"
                fill="#FF7A1A"
              />
            </svg>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                lineHeight: 1.2,
                color: '#073B7A',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {step.title}
            </div>
          </div>

          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: '#FF7A1A',
              flexShrink: 0,
            }}
          >
            {stepNumber}/{totalSteps}
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            fontSize: 14,
            lineHeight: 1.45,
            fontWeight: 700,
            color: '#344054',
          }}
        >
          {step.content}
        </div>

        <div
          style={{
            marginTop: 18,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {stepNumber < totalSteps ? (
            <button
              type="button"
              onClick={onSkip}
              style={{
                width: 68,
                height: 40,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: "'Inter', system-ui, sans-serif",
                fontWeight: 800,
                fontSize: 14,
                color: '#FF7A1A',
                padding: 0,
                textAlign: 'left',
              }}
            >
              Skip
            </button>
          ) : (
            <div style={{ width: 68 }} />
          )}

          <div style={{ flex: 1 }} />

          {stepNumber > 1 && (
            <button
              type="button"
              onClick={onBack}
              style={{
                width: 76,
                height: 40,
                border: '1px solid #0B4EA2',
                borderRadius: 12,
                backgroundColor: 'transparent',
                color: '#0B4EA2',
                cursor: 'pointer',
                fontFamily: "'Inter', system-ui, sans-serif",
                fontWeight: 700,
                fontSize: 14,
                padding: 0,
                marginRight: 8,
                textAlign: 'center',
              }}
            >
              Back
            </button>
          )}

          <button
            type="button"
            onClick={onNext}
            style={{
              width: 86,
              height: 40,
              border: 'none',
              borderRadius: 12,
              backgroundColor: '#0B4EA2',
              color: '#FFFFFF',
              cursor: 'pointer',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontWeight: 900,
              fontSize: 14,
              padding: 0,
              textAlign: 'center',
            }}
          >
            {stepNumber === totalSteps ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
