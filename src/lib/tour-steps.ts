import { Step } from 'react-joyride';
import { UserRole } from '@/types/api';

export function getTourStepsForRole(role: UserRole): Step[] {
  const steps: Step[] = [];

  steps.push({
    target: '[data-tour="tour-dashboard"]',
    content: 'Welcome! This is your Dashboard, giving you a quick overview of your metrics and activity.',
    // @ts-expect-error: disableBeacon exists
    disableBeacon: true,
  });

  if (role === 'SUPER_ADMIN' || role === 'PARTNER_ADMIN') {
    steps.push({
      target: '[data-tour="tour-organizations"]',
      content: 'Here you can manage your Organizations and Partners. Set up custom branding, limits, and view their usage.',
    });
  }

  if (role === 'SUPER_ADMIN' || role === 'CUSTOMER_ADMIN' || role === 'PARTNER_ADMIN') {
    steps.push({
      target: '[data-tour="tour-users"]',
      content: 'Manage the users in your organization, including Teachers and Students. You can invite them or import in bulk.',
    });
  }

  steps.push({
    target: '[data-tour="tour-license"]',
    content: 'The License module shows your current seat limits, active devices, and hardware activation keys.',
  });

  steps.push({
    target: '[data-tour="tour-ai"]',
    content: 'This is the AI module. Monitor AI usage, view your current AI credits, and see details on master keys.',
  });

  steps.push({
    target: '[data-tour="tour-settings"]',
    content: 'Finally, you can customize your profile, app settings, and replay this tour anytime from Settings!',
  });

  return steps;
}
