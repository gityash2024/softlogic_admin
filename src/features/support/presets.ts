import type { SupportCategory, SupportPriority } from '@/types/api';

export interface SupportCategoryPreset {
  category: SupportCategory;
  label: string;
  helperText: string;
  subjectTemplate: string;
  defaultPriority: SupportPriority;
  actionable: boolean;
  actionKind?:
    | 'seats_increase'
    | 'seats_decrease'
    | 'reset_device'
    | 'disable_org'
    | 'enable_org'
    | 'extend_key_expiry';
}

export const SUPPORT_CATEGORY_PRESETS: SupportCategoryPreset[] = [
  {
    category: 'REQUEST_SEATS',
    label: 'Request more seats',
    helperText: 'Ask the super admin to raise teacher licence capacity.',
    subjectTemplate: 'Request to raise teacher licence capacity',
    defaultPriority: 'NORMAL',
    actionable: true,
    actionKind: 'seats_increase',
  },
  {
    category: 'EXTEND_SUBSCRIPTION',
    label: 'Extend licence/key term',
    helperText: 'Ask the super admin to extend activation-key terms from Licence.',
    subjectTemplate: 'Extend licence/key term',
    defaultPriority: 'NORMAL',
    actionable: false,
  },
  {
    category: 'RESET_DEVICE',
    label: 'Reset activation key on a device',
    helperText: 'A device is lost / replaced — release its key for re-binding.',
    subjectTemplate: 'Reset activation device',
    defaultPriority: 'HIGH',
    actionable: true,
    actionKind: 'reset_device',
  },
  {
    category: 'ACTIVATION_ISSUE',
    label: 'Activation key not working',
    helperText: 'My team can’t activate their device with the key we received.',
    subjectTemplate: 'Activation key issue',
    defaultPriority: 'HIGH',
    actionable: false,
  },
  {
    category: 'BILLING',
    label: 'Billing question',
    helperText: 'Invoice, offline payment, or pricing.',
    subjectTemplate: 'Billing question',
    defaultPriority: 'NORMAL',
    actionable: false,
  },
  {
    category: 'TECHNICAL',
    label: 'Technical issue',
    helperText: 'Bug, crash, or unexpected behaviour in the app.',
    subjectTemplate: 'Technical issue',
    defaultPriority: 'NORMAL',
    actionable: false,
  },
  {
    category: 'USER_MANAGEMENT',
    label: 'Help with users / roles',
    helperText: 'Question about inviting users, role changes, or seat usage.',
    subjectTemplate: 'User management help',
    defaultPriority: 'LOW',
    actionable: false,
  },
  {
    category: 'GENERAL',
    label: 'General question',
    helperText: 'Anything else — we’ll route it from here.',
    subjectTemplate: 'General question',
    defaultPriority: 'LOW',
    actionable: false,
  },
];

export const findPreset = (category: SupportCategory): SupportCategoryPreset | undefined =>
  SUPPORT_CATEGORY_PRESETS.find((preset) => preset.category === category);
