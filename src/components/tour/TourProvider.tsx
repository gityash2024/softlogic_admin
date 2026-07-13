import { createContext, useContext, ReactNode, useState, useCallback, useEffect } from 'react';
import { Joyride, EventData, STATUS, Step } from 'react-joyride';
const JoyrideAny = Joyride as any;
import { useAuthStore } from '@/lib/auth-store';
import { runtimeBrandForOrganization } from '@/lib/branding';
import { getTourStepsForRole } from '@/lib/tour-steps';

interface TourContextValue {
  startTour: () => void;
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

export function TourProvider({ children }: TourProviderProps) {
  const user = useAuthStore((state) => state.user);
  const brand = runtimeBrandForOrganization(user?.primaryOrganization);

  const [run, setRun] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => {
    if (user) {
      setSteps(getTourStepsForRole(user.role));
      const hasSeen = localStorage.getItem(`hasSeenTour_${user.id}`);
      if (!hasSeen) {
        // slight delay to let DOM render
        setTimeout(() => setRun(true), 500);
      }
    }
  }, [user]);

  const startTour = useCallback(() => {
    setRun(true);
  }, []);

  const handleJoyrideCallback = (data: EventData) => {
    const { status } = data;
    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      setRun(false);
      if (user) {
        localStorage.setItem(`hasSeenTour_${user.id}`, 'true');
      }
    }
  };

  return (
    <TourContext.Provider value={{ startTour }}>
      <JoyrideAny
        steps={steps}
        run={run}
        continuous
        callback={handleJoyrideCallback}
        styles={
          {
            options: {
              primaryColor: brand.primaryColor,
              zIndex: 10000,
            },
            buttonNext: {
              backgroundColor: brand.primaryColor,
            },
            buttonBack: {
              color: brand.primaryColor,
            },
          } as any
        }
      />
      {children}
    </TourContext.Provider>
  );
}
