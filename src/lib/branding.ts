import type { CSSProperties } from 'react';
import type { OrganizationSummary } from '@/types/api';

const SOFTLOGIC_PRIMARY = '#1149B5';
const SOFTLOGIC_NAVY = '#08357C';
const SOFTLOGIC_ACCENT = '#FF7A00';

export interface RuntimeBrand {
  isWhiteLabel: boolean;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  navyColor: string;
  accentColor: string;
}

const isHexColor = (value: string | null | undefined): value is string =>
  /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value?.trim() ?? '');

const normalizeHex = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 4) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }
  return trimmed;
};

export const runtimeBrandForOrganization = (
  organization?: OrganizationSummary | null,
): RuntimeBrand => {
  const isWhiteLabel = organization?.brandingMode === 'WHITE_LABEL';
  if (!isWhiteLabel) {
    return {
      isWhiteLabel: false,
      name: 'SoftLogic',
      logoUrl: null,
      primaryColor: SOFTLOGIC_PRIMARY,
      navyColor: SOFTLOGIC_NAVY,
      accentColor: SOFTLOGIC_ACCENT,
    };
  }

  const primaryColor = isHexColor(organization.brandPrimaryColor)
    ? normalizeHex(organization.brandPrimaryColor)
    : SOFTLOGIC_PRIMARY;
  const accentColor = isHexColor(organization.brandAccentColor)
    ? normalizeHex(organization.brandAccentColor)
    : SOFTLOGIC_ACCENT;

  return {
    isWhiteLabel: true,
    name: organization.brandName?.trim() || organization.name,
    logoUrl: organization.logoUrl,
    primaryColor,
    navyColor: primaryColor,
    accentColor,
  };
};

export const runtimeBrandStyle = (brand: RuntimeBrand): CSSProperties => ({
  '--brand-primary': brand.primaryColor,
  '--brand-navy': brand.navyColor,
  '--brand-blue': brand.primaryColor,
  '--brand-blue-dark': brand.navyColor,
  '--brand-orange': brand.accentColor,
} as CSSProperties);
