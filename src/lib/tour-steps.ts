import { UserRole } from '@/types/api';

export interface AppTourStep {
  id: string;
  target: string;
  title: string;
  content: string;
  route: string;
  placement?: 'top' | 'bottom';
  preActionSelector?: string;
  preActionSelectors?: string[];
  preActionForce?: boolean;
  preActionEvent?: string;
}

export type TourProfile = 'initial' | 'organizations' | 'users' | 'license' | 'ai';

export function getTourStepsForProfile(profile: TourProfile, role: UserRole): AppTourStep[] {
  const steps: AppTourStep[] = [];

  if (profile === 'initial') {
    // --- HIGH-LEVEL INITIAL ONBOARDING ---
    steps.push({
      id: 'dashboard-welcome',
      target: '[data-tour="tour-dashboard-stats"]',
      title: 'Welcome to SoftLogic Admin',
      content: 'This is your command centre. Here you can see a real-time snapshot of your workspace — active users, organisations, teacher licence utilisation, and system health.',
      route: '/dashboard',
      placement: 'bottom',
    });
    
    steps.push({
      id: 'dashboard-metrics',
      target: '[data-tour="tour-dashboard-metrics"]',
      title: 'Performance Metrics',
      content: 'Key performance indicators and overall growth signals are aggregated here.',
      route: '/dashboard',
      placement: 'bottom',
    });

    if (role === 'SUPER_ADMIN' || role === 'PARTNER_ADMIN') {
      steps.push({
        id: 'organizations-list',
        target: '[data-tour="tour-organizations-list"]',
        title: 'Organisations',
        content: 'Manage your customer schools and partners here. You can provision new workspaces and configure custom branding.',
        route: '/organizations',
        placement: 'bottom',
      });
    }

    if (role === 'SUPER_ADMIN' || role === 'CUSTOMER_ADMIN' || role === 'PARTNER_ADMIN') {
      steps.push({
        id: 'users-list',
        target: '[data-tour="tour-users-list"]',
        title: 'User Management',
        content: 'Invite Teachers, Admins, and Students. We securely handle email invitations and password setup automatically.',
        route: '/users',
        placement: 'bottom',
      });
    }

    steps.push({
      id: 'license-stats',
      target: '[data-tour="tour-license-stats"]',
      title: 'Licensing & Seats',
      content: 'Monitor seat capacity and generate hardware activation keys for interactive panels.',
      route: '/license',
      placement: 'bottom',
    });

    if (role === 'SUPER_ADMIN') {
      steps.push({
        id: 'ai-credits',
        target: '[data-tour="tour-ai-credits"]',
        title: 'AI Credits',
        content: 'Monitor your global AI credit pool and allocate credits down the hierarchy to specific organisations.',
        route: '/ai',
        placement: 'bottom',
      });
    }

    steps.push({
      id: 'tour-sidebar-settings',
      target: '[data-tour="tour-settings"]',
      title: 'Profile Settings',
      content: 'Customise your profile, password, and active locale.',
      route: '/settings',
      placement: 'bottom',
    });

    steps.push({
      id: 'tour-sidebar-downloads',
      target: '[data-tour="tour-downloads"]',
      title: 'Downloads',
      content: 'Get the latest Android and Windows whiteboarding software for your hardware.',
      route: '/downloads',
      placement: 'bottom',
    });

    steps.push({
      id: 'tour-completion',
      target: 'body', // Fallback to center screen
      title: 'Explore More',
      content: 'That concludes the high-level overview! For deep-dives into specific modules, look for the floating Help icon in the bottom right corner of any page.',
      route: '/dashboard',
      placement: 'bottom',
    });
  } else if (profile === 'organizations') {
    // --- ORGANIZATIONS DEEP DIVE ---
    steps.push({
      id: 'org-create-btn',
      target: 'button:has(svg.lucide-plus)',
      title: 'Create an Organisation',
      content: 'Click here to provision a new customer or partner workspace.',
      route: '/organizations',
      placement: 'bottom',
    });
    steps.push({
      id: 'org-name',
      target: 'input[name="name"]',
      title: 'Organisation Name',
      content: 'Enter the official name of the partner or customer.',
      route: '/organizations/new',
      placement: 'bottom',
    });
    steps.push({
      id: 'org-branding',
      target: '#tour-org-colors',
      title: 'Custom Branding',
      content: 'Set primary and secondary colours to white-label the workspace.',
      route: '/organizations/new',
      placement: 'bottom',
    });
    steps.push({
      id: 'org-submit',
      target: '#tour-org-submit',
      title: 'Save Organisation',
      content: 'Click here to provision the organisation workspace instantly.',
      route: '/organizations/new',
      placement: 'top',
    });
  } else if (profile === 'users') {
    // --- USERS DEEP DIVE ---
    steps.push({
      id: 'user-create-btn',
      target: 'button:has(svg.lucide-plus)',
      title: 'Invite a User',
      content: 'Click here to invite a new teacher, admin, or student.',
      route: '/users',
      placement: 'bottom',
    });
    steps.push({
      id: 'user-email',
      target: 'input[name="email"]',
      title: 'Email Invitation',
      content: 'Enter the user\'s email. They will receive a secure setup link via Brevo to create their password.',
      route: '/users/new',
      placement: 'bottom',
    });
    steps.push({
      id: 'user-role',
      target: '#tour-user-role',
      title: 'Assign a Role',
      content: 'The role defines their permissions. Teachers can create content; Admins manage the workspace.',
      route: '/users/new',
      placement: 'bottom',
    });
    steps.push({
      id: 'user-submit',
      target: 'button[type="submit"]',
      title: 'Send Invite',
      content: 'Click save to securely dispatch the invitation email.',
      route: '/users/new',
      placement: 'top',
    });
  } else if (profile === 'license') {
    // --- LICENSE DEEP DIVE ---
    steps.push({
      id: 'license-stats-deep',
      target: '[data-tour="tour-license-stats"]',
      title: 'Seat Allocation Tracker',
      content: 'This card tracks how many of your total teacher seats are actively consumed by registered users.',
      route: '/license',
      placement: 'bottom',
    });
    if (role === 'SUPER_ADMIN' || role === 'PARTNER_ADMIN') {
      steps.push({
        id: 'license-org-select',
        target: '[data-tour="tour-license-org-select"]',
        title: 'Select an Organisation',
        content: 'Select a specific partner or organisation here to manage their individual activation keys and allocations.',
        route: '/license',
        placement: 'bottom',
        preActionSelectors: ['[data-tour="tour-license-org-select"]', '[role="option"]:nth-of-type(2)']
      });
    }
    steps.push({
      id: 'license-generate',
      target: '[data-tour="tour-license-bulk-create"], [data-tour="tour-license-bulk-create-secondary"]',
      title: 'Generate Hardware Keys',
      content: 'Click here to generate a batch of secure hardware activation keys for interactive panels.',
      route: '/license',
      placement: 'bottom',
    });
    steps.push({
      id: 'license-generate-type',
      target: '[data-tour="tour-license-bulk-auto"]',
      title: 'Auto Generation',
      content: 'Select the automatic mode to let the system instantly generate random, secure keys.',
      route: '/license',
      placement: 'bottom',
      preActionSelectors: ['[data-tour="tour-license-bulk-create"], [data-tour="tour-license-bulk-create-secondary"]', '[data-tour="tour-license-bulk-auto"]']
    });
    steps.push({
      id: 'license-generate-qty',
      target: '[data-tour="tour-license-bulk-qty"]',
      title: 'Quantity',
      content: 'Specify exactly how many activation keys you need to provision for your hardware shipment.',
      route: '/license',
      placement: 'bottom',
    });
    steps.push({
      id: 'license-generate-submit',
      target: '[data-tour="tour-license-bulk-submit"]',
      title: 'Generate',
      content: 'Click to finalise. The keys will be instantly generated and available to download or copy.',
      route: '/license',
      placement: 'top',
    });
    if (role === 'SUPER_ADMIN' || role === 'PARTNER_ADMIN') {
      steps.push({
        id: 'license-assign-keys',
        target: '[data-tour="tour-license-assign-keys"]',
        title: 'Assign Pool Keys',
        content: 'Once keys are generated in your partner pool, you can click here to assign and email them down to your child organisations.',
        route: '/license',
        placement: 'top',
        preActionEvent: 'tour-action-close-modals',
      });
      steps.push({
        id: 'license-assign-keys-submit',
        target: '[data-tour="tour-license-assign-keys-submit"]',
        title: 'Confirm Assignment',
        content: 'Select the child organisation, choose the keys, and click this button. The admin of that organisation will receive the keys via email securely.',
        route: '/license',
        placement: 'top',
        preActionSelector: '[data-tour="tour-license-assign-keys"]'
      });
    }
  } else if (profile === 'ai') {
    // --- AI DEEP DIVE ---
    steps.push({
      id: 'ai-pool',
      target: '[data-tour="tour-ai-credits"]',
      title: 'Global Credit Pool',
      content: 'Monitor how many total AI credits are available and consumed across your entire hierarchy.',
      route: '/ai',
      placement: 'bottom',
    });
    steps.push({
      id: 'ai-allocate',
      target: 'form[data-tour="tour-ai-allocate-form"]',
      title: 'Allocate Credits',
      content: 'Use this form to distribute credits to specific organisations or users.',
      route: '/ai',
      placement: 'top',
    });
    steps.push({
      id: 'ai-allocate-target',
      target: '[data-tour="tour-ai-allocate-target"]',
      title: 'Select Target',
      content: 'Choose whether you are allocating credits to an entire Organisation or a specific User.',
      route: '/ai',
      placement: 'bottom',
      preActionSelectors: ['[data-tour="tour-ai-allocate-target"]', '[role="option"]:nth-of-type(2)']
    });
    steps.push({
      id: 'ai-allocate-amount',
      target: '[data-tour="tour-ai-allocate-amount"]',
      title: 'Credit Amount',
      content: 'Enter the number of credits. One credit roughly equals one token of AI processing.',
      route: '/ai',
      placement: 'bottom',
    });
    steps.push({
      id: 'ai-allocate-submit',
      target: '[data-tour="tour-ai-allocate-submit"]',
      title: 'Confirm Allocation',
      content: 'Click here to apply the allocation. Credits cascade securely down the hierarchy.',
      route: '/ai',
      placement: 'top',
    });
  }

  return steps;
}
