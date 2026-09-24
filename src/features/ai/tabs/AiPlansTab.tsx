import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Copy, Pencil, Plus, Save, Send, Star } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { extractApiError } from '@/lib/api';
import { aiBillingApi } from '@/services/ai-billing.api';
import type { AiBillingConfig, AiGatewayConfig, AiGatewayMode, AiPlan, BillingCurrency } from '@/types/ai';
import { LoadingBlock, SectionHeader } from '../components/ai-ui';
import { formatCredits, formatDateTime, formatMinor, previewCredits } from '../components/ai-format';
import { AiOrdersPanel } from './AiOrdersPanel';

const majorToMinor = (value: string) => (value.trim() === '' ? null : Math.round(Number(value) * 100));
const minorToMajor = (minor: number | null | undefined) => (minor === null || minor === undefined ? '' : String(minor / 100));

export function AiPlansTab() {
  const configQuery = useQuery({ queryKey: ['ai-billing-config'], queryFn: aiBillingApi.config });
  return (
    <div className="space-y-5">
      {configQuery.isError ? (
        <Card className="px-4 py-5 text-sm text-red-700 sm:px-6">{extractApiError(configQuery.error)}</Card>
      ) : !configQuery.data ? (
        <Card className="px-4 py-5 sm:px-6">
          <LoadingBlock />
        </Card>
      ) : (
        <>
          <BillingConfigCard config={configQuery.data} />
          <PlansCard config={configQuery.data} />
          <GatewaysCard />
          <AiOrdersPanel />
        </>
      )}
    </div>
  );
}

type ConfigForm = {
  enabled: boolean;
  fxInrPerUsd: string;
  priceToCreditDivisor: string;
  creditValidityMonths: string;
  gstPercent: string;
  gstin: string;
  sacCode: string;
  invoicePrefix: string;
  legalName: string;
  address: string;
  state: string;
  email: string;
  phone: string;
  pan: string;
  customPurchaseEnabled: boolean;
  customMinInr: string;
  customMaxInr: string;
  customMinUsd: string;
  customMaxUsd: string;
};

const toConfigForm = (config: AiBillingConfig): ConfigForm => ({
  enabled: config.enabled,
  fxInrPerUsd: String(config.fxInrPerUsd),
  priceToCreditDivisor: String(config.priceToCreditDivisor),
  creditValidityMonths: String(config.creditValidityMonths),
  gstPercent: String(config.gstPercent),
  gstin: config.gstin ?? '',
  sacCode: config.sacCode ?? '',
  invoicePrefix: config.invoicePrefix,
  legalName: config.sellerDetails?.legalName ?? '',
  address: config.sellerDetails?.address ?? '',
  state: config.sellerDetails?.state ?? '',
  email: config.sellerDetails?.email ?? '',
  phone: config.sellerDetails?.phone ?? '',
  pan: config.sellerDetails?.pan ?? '',
  customPurchaseEnabled: config.customPurchaseEnabled,
  customMinInr: minorToMajor(config.customMinInrMinor),
  customMaxInr: minorToMajor(config.customMaxInrMinor),
  customMinUsd: minorToMajor(config.customMinUsdMinor),
  customMaxUsd: minorToMajor(config.customMaxUsdMinor),
});

function BillingConfigCard({ config }: { config: AiBillingConfig }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ConfigForm>(() => toConfigForm(config));
  useEffect(() => {
    const timer = window.setTimeout(() => setForm(toConfigForm(config)), 0);
    return () => window.clearTimeout(timer);
  }, [config]);

  const mutation = useMutation({
    mutationFn: () =>
      aiBillingApi.updateConfig({
        enabled: form.enabled,
        fxInrPerUsd: Number(form.fxInrPerUsd),
        priceToCreditDivisor: Number(form.priceToCreditDivisor),
        creditValidityMonths: Number(form.creditValidityMonths),
        gstPercent: Number(form.gstPercent),
        gstin: form.gstin.trim() || null,
        sacCode: form.sacCode.trim() || null,
        invoicePrefix: form.invoicePrefix.trim(),
        sellerDetails: {
          legalName: form.legalName.trim(),
          address: form.address.trim(),
          state: form.state.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          pan: form.pan.trim(),
        },
        customPurchaseEnabled: form.customPurchaseEnabled,
        customMinInrMinor: majorToMinor(form.customMinInr) ?? undefined,
        customMaxInrMinor: majorToMinor(form.customMaxInr) ?? undefined,
        customMinUsdMinor: majorToMinor(form.customMinUsd) ?? undefined,
        customMaxUsdMinor: majorToMinor(form.customMaxUsd) ?? undefined,
      }),
    onSuccess: () => {
      toast.success('Billing settings saved');
      queryClient.invalidateQueries({ queryKey: ['ai-billing-config'] });
      queryClient.invalidateQueries({ queryKey: ['ai-billing-plans'] });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const field = (key: keyof ConfigForm, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{label}</label>
      <Input value={form[key] as string} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} {...props} />
    </div>
  );

  const divisor = Number(form.priceToCreditDivisor) || 1;
  return (
    <Card className="space-y-4 px-4 py-5 sm:px-6">
      <SectionHeader
        title="Pro purchases"
        description={`Buyers pay ${divisor}× the value of the credits they receive (1 credit = $0.000001). Purchased credits expire after the validity period.`}
        actions={
          <Button type="button" variant="primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        }
      />
      <label className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-3 text-sm font-semibold text-ink-900">
        <input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} />
        Sell Pro credits (shows Settings › SoftLogic AI to customer, admin and partner admins while Pro is ON)
      </label>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {field('priceToCreditDivisor', 'Price ÷ credit value (2 = 2X price)', { type: 'number', min: 1, step: '0.1' })}
        {field('fxInrPerUsd', 'INR per USD', { type: 'number', min: 1, step: '0.01' })}
        {field('creditValidityMonths', 'Validity (months)', { type: 'number', min: 1, max: 60 })}
        {field('gstPercent', 'GST % (INR only)', { type: 'number', min: 0, max: 50, step: '0.01' })}
        {field('gstin', 'Seller GSTIN')}
        {field('sacCode', 'SAC code')}
        {field('invoicePrefix', 'Invoice prefix')}
        {field('pan', 'PAN')}
        {field('legalName', 'Seller legal name')}
        {field('state', 'Seller state (for CGST/SGST)')}
        {field('email', 'Billing email')}
        {field('phone', 'Billing phone')}
      </div>
      {field('address', 'Seller address')}

      <div className="space-y-2 rounded-lg border border-line bg-surface-variant/60 px-3 py-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <input type="checkbox" checked={form.customPurchaseEnabled} onChange={(event) => setForm((current) => ({ ...current, customPurchaseEnabled: event.target.checked }))} />
          Allow custom credit amounts
        </label>
        <p className="text-xs text-ink-500">Buyers can type credits or an amount instead of choosing a plan. The same price ÷ credit rule applies.</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {field('customMinInr', 'Minimum (₹)', { type: 'number', min: 1 })}
          {field('customMaxInr', 'Maximum (₹)', { type: 'number', min: 1 })}
          {field('customMinUsd', 'Minimum ($)', { type: 'number', min: 1 })}
          {field('customMaxUsd', 'Maximum ($)', { type: 'number', min: 1 })}
        </div>
      </div>
      <p className="text-xs text-ink-400">Last updated {formatDateTime(config.updatedAt)}</p>
    </Card>
  );
}

type PlanForm = {
  id?: string;
  code: string;
  name: string;
  description: string;
  priceInr: string;
  priceUsd: string;
  creditsOverride: string;
  divisorOverride: string;
  validityMonths: string;
  features: string;
  isPopular: boolean;
  sortOrder: string;
  active: boolean;
};

const planToForm = (plan?: AiPlan): PlanForm => ({
  id: plan?.id,
  code: plan?.code ?? '',
  name: plan?.name ?? '',
  description: plan?.description ?? '',
  priceInr: minorToMajor(plan?.prices.INR?.amountMinor),
  priceUsd: minorToMajor(plan?.prices.USD?.amountMinor),
  creditsOverride: plan?.creditsOverride ? String(plan.creditsOverride) : '',
  divisorOverride: plan?.divisorOverride ? String(plan.divisorOverride) : '',
  validityMonths: plan?.validityMonths ? String(plan.validityMonths) : '',
  features: (plan?.features ?? []).join('\n'),
  isPopular: plan?.isPopular ?? false,
  sortOrder: String(plan?.sortOrder ?? 0),
  active: plan?.active ?? true,
});

function PlansCard({ config }: { config: AiBillingConfig }) {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const plansQuery = useQuery({ queryKey: ['ai-billing-plans', showArchived], queryFn: () => aiBillingApi.plans(showArchived) });
  const [form, setForm] = useState<PlanForm | null>(null);
  const [archiving, setArchiving] = useState<AiPlan | null>(null);

  const saveMutation = useMutation({
    mutationFn: (value: PlanForm) => {
      const payload = {
        code: value.code.trim(),
        name: value.name.trim(),
        description: value.description.trim() || null,
        priceInrMinor: majorToMinor(value.priceInr),
        priceUsdMinor: majorToMinor(value.priceUsd),
        creditsOverride: value.creditsOverride.trim() ? Number(value.creditsOverride) : null,
        divisorOverride: value.divisorOverride.trim() ? Number(value.divisorOverride) : null,
        validityMonths: value.validityMonths.trim() ? Number(value.validityMonths) : null,
        features: value.features.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 10),
        isPopular: value.isPopular,
        sortOrder: Number(value.sortOrder || 0),
        active: value.active,
      };
      return value.id ? aiBillingApi.updatePlan(value.id, payload) : aiBillingApi.createPlan(payload);
    },
    onSuccess: () => {
      toast.success('Plan saved');
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ['ai-billing-plans'] });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });
  const archiveMutation = useMutation({
    mutationFn: (id: string) => aiBillingApi.archivePlan(id),
    onSuccess: () => {
      toast.success('Plan archived. Existing orders keep their snapshot.');
      setArchiving(null);
      queryClient.invalidateQueries({ queryKey: ['ai-billing-plans'] });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const divisorFor = (value: PlanForm) => Number(value.divisorOverride) || config.priceToCreditDivisor;
  const creditsFor = (value: PlanForm, currency: BillingCurrency) =>
    value.creditsOverride.trim()
      ? Number(value.creditsOverride)
      : previewCredits(currency, majorToMinor(currency === 'INR' ? value.priceInr : value.priceUsd), config.fxInrPerUsd, divisorFor(value));

  return (
    <Card className="space-y-4 px-4 py-5 sm:px-6">
      <SectionHeader
        title="Plan catalog"
        description="Plans shown as cards to buyers. Credits are calculated from the price unless you set a fixed credit amount."
        actions={
          <>
            <label className="flex items-center gap-2 text-xs text-ink-600">
              <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
              Show archived
            </label>
            <Button type="button" variant="primary" size="sm" onClick={() => setForm(planToForm())}>
              <Plus className="h-4 w-4" />
              New plan
            </Button>
          </>
        }
      />
      {plansQuery.isLoading ? (
        <LoadingBlock />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(plansQuery.data ?? []).map((plan) => (
            <div key={plan.id} className={`relative rounded-xl border px-4 py-4 ${plan.isPopular ? 'border-brand-primary shadow-card' : 'border-line'} ${plan.archivedAt || !plan.active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-base font-black text-ink-900">{plan.name}</p>
                  <p className="font-mono text-[11px] text-ink-400">{plan.code}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  {plan.isPopular ? (
                    <Badge variant="navy">
                      <Star className="h-3 w-3" />
                      Popular
                    </Badge>
                  ) : null}
                  {plan.archivedAt ? <Badge>Archived</Badge> : !plan.active ? <Badge variant="warning">Hidden</Badge> : null}
                </div>
              </div>
              {plan.description ? <p className="mt-1 text-xs text-ink-500">{plan.description}</p> : null}
              <div className="mt-3 space-y-1 text-sm">
                {(['INR', 'USD'] as const).map((currency) =>
                  plan.prices[currency] ? (
                    <p key={currency} className="flex justify-between gap-2">
                      <span className="font-bold text-ink-900">{formatMinor(currency, plan.prices[currency]!.amountMinor)}</span>
                      <span className="text-xs text-ink-500">{formatCredits(plan.prices[currency]!.credits)} credits</span>
                    </p>
                  ) : null,
                )}
              </div>
              <p className="mt-2 text-xs text-ink-500">Valid {plan.validityMonths} months</p>
              <div className="mt-3 flex flex-wrap gap-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setForm(planToForm(plan))}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                {!plan.archivedAt ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setArchiving(plan)}>
                    <Archive className="h-4 w-4" />
                    Archive
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={Boolean(form)} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form?.id ? 'Edit plan' : 'New plan'}</DialogTitle>
            <DialogDescription>Price changes apply to new orders only.</DialogDescription>
          </DialogHeader>
          {form ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Code (e.g. standard)" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
              <Input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              <Input className="sm:col-span-2" placeholder="Short description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Price (₹, before GST)</label>
                <Input type="number" min={0} value={form.priceInr} onChange={(event) => setForm({ ...form, priceInr: event.target.value })} />
                <p className="text-xs text-ink-500">= {formatCredits(creditsFor(form, 'INR'))} credits</p>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Price ($)</label>
                <Input type="number" min={0} value={form.priceUsd} onChange={(event) => setForm({ ...form, priceUsd: event.target.value })} />
                <p className="text-xs text-ink-500">= {formatCredits(creditsFor(form, 'USD'))} credits</p>
              </div>
              <Input type="number" min={1} placeholder="Fixed credits (optional)" value={form.creditsOverride} onChange={(event) => setForm({ ...form, creditsOverride: event.target.value })} />
              <Input type="number" min={1} step="0.1" placeholder={`Divisor override (default ${config.priceToCreditDivisor})`} value={form.divisorOverride} onChange={(event) => setForm({ ...form, divisorOverride: event.target.value })} />
              <Input type="number" min={1} max={60} placeholder={`Validity months (default ${config.creditValidityMonths})`} value={form.validityMonths} onChange={(event) => setForm({ ...form, validityMonths: event.target.value })} />
              <Input type="number" placeholder="Sort order" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} />
              <Textarea className="sm:col-span-2" rows={4} placeholder="Features, one per line (max 10)" value={form.features} onChange={(event) => setForm({ ...form, features: event.target.value })} />
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" checked={form.isPopular} onChange={(event) => setForm({ ...form, isPopular: event.target.checked })} />
                Mark as popular
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
                Visible to buyers
              </label>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button type="button" variant="primary" disabled={saveMutation.isPending || !form?.code.trim() || !form?.name.trim()} onClick={() => form && saveMutation.mutate(form)}>
              {saveMutation.isPending ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              Save plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={Boolean(archiving)}
        onOpenChange={(open) => !open && setArchiving(null)}
        title={`Archive ${archiving?.name ?? 'plan'}?`}
        description="Buyers will no longer see it. Past orders and their credits are not affected."
        confirmLabel="Archive"
        tone="warning"
        loading={archiveMutation.isPending}
        onConfirm={() => archiving && archiveMutation.mutate(archiving.id)}
      />
    </Card>
  );
}

function GatewaysCard() {
  const gatewaysQuery = useQuery({ queryKey: ['ai-billing-gateways'], queryFn: aiBillingApi.gateways });
  return (
    <Card className="space-y-4 px-4 py-5 sm:px-6">
      <SectionHeader title="Payment gateways" description="Enable the gateways buyers can choose. Keep TEST mode until live credentials are verified." />
      {gatewaysQuery.isLoading ? (
        <LoadingBlock />
      ) : gatewaysQuery.isError ? (
        <p className="text-sm text-red-700">{extractApiError(gatewaysQuery.error)}</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {(gatewaysQuery.data ?? []).map((gateway) => (
            <GatewayCard key={gateway.gateway} gateway={gateway} />
          ))}
        </div>
      )}
    </Card>
  );
}

function GatewayCard({ gateway }: { gateway: AiGatewayConfig }) {
  const queryClient = useQueryClient();
  const [credentialsMode, setCredentialsMode] = useState<AiGatewayMode>(gateway.mode);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [webhookSecret, setWebhookSecret] = useState('');
  const [merchantName, setMerchantName] = useState(String(gateway.publicConfig?.merchantName ?? ''));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ai-billing-gateways'] });
  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof aiBillingApi.updateGateway>[1]) => aiBillingApi.updateGateway(gateway.gateway, payload),
    onSuccess: () => {
      toast.success(`${gateway.displayName} saved`);
      setCredentials({});
      setWebhookSecret('');
      invalidate();
    },
    onError: (error) => toast.error(extractApiError(error)),
  });
  const testMutation = useMutation({
    mutationFn: () => aiBillingApi.testGateway(gateway.gateway, credentialsMode),
    onSuccess: (response) => {
      const result = response.data;
      toast[result.lastTestStatus === 'SUCCESS' ? 'success' : 'error'](result.lastTestMessage ?? response.message ?? 'Tested');
      invalidate();
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const saved = gateway.credentials?.[credentialsMode] ?? {};
  const webhookUrl = gateway.webhookUrls?.[credentialsMode];
  const saveCredentials = () => {
    const filled = Object.fromEntries(Object.entries(credentials).filter(([, value]) => value.trim()));
    updateMutation.mutate({
      credentialsMode,
      credentials: Object.keys(filled).length ? filled : undefined,
      webhookSecret: webhookSecret.trim() || undefined,
      publicConfig: { ...gateway.publicConfig, merchantName: merchantName.trim() || undefined },
    });
  };

  return (
    <div className="space-y-3 rounded-xl border border-line bg-white px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-base font-bold text-ink-900">{gateway.displayName}</p>
          <p className="text-xs text-ink-500">Currencies: {gateway.supportedCurrencies.join(', ') || '—'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={gateway.mode === 'LIVE' ? 'danger' : 'info'}>{gateway.mode}</Badge>
          <label className="flex items-center gap-2 text-sm font-semibold text-ink-700">
            <input type="checkbox" checked={gateway.enabled} disabled={updateMutation.isPending} onChange={(event) => updateMutation.mutate({ enabled: event.target.checked })} />
            Enabled
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-ink-500">Checkout mode:</span>
        {(['TEST', 'LIVE'] as const).map((mode) => (
          <Button
            key={mode}
            type="button"
            size="sm"
            variant={gateway.mode === mode ? 'primary' : 'outline'}
            disabled={updateMutation.isPending || gateway.mode === mode}
            onClick={() => {
              if (mode === 'LIVE' && !window.confirm(`Switch ${gateway.displayName} to LIVE? Real payments will be taken.`)) return;
              updateMutation.mutate({ mode });
            }}
          >
            {mode}
          </Button>
        ))}
      </div>

      <div className="space-y-2 rounded-lg border border-line bg-surface-variant/50 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Credentials</p>
          <div className="inline-flex rounded-md border border-line bg-white p-0.5">
            {(['TEST', 'LIVE'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`rounded px-2 py-1 text-[11px] font-bold ${credentialsMode === mode ? 'bg-brand-navy text-white' : 'text-ink-500'}`}
                onClick={() => {
                  setCredentialsMode(mode);
                  setCredentials({});
                  setWebhookSecret('');
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
        {gateway.credentialFields.map((fieldDef) => (
          <div key={fieldDef.key} className="grid gap-1 sm:grid-cols-[160px_1fr] sm:items-center">
            <label className="text-xs text-ink-600">{fieldDef.label}</label>
            <Input
              className="h-9"
              type={fieldDef.secret ? 'password' : 'text'}
              autoComplete="off"
              placeholder={saved[fieldDef.key] ?? 'Not set'}
              value={credentials[fieldDef.key] ?? ''}
              onChange={(event) => setCredentials((current) => ({ ...current, [fieldDef.key]: event.target.value }))}
            />
          </div>
        ))}
        <div className="grid gap-1 sm:grid-cols-[160px_1fr] sm:items-center">
          <label className="text-xs text-ink-600">Webhook secret</label>
          <Input
            className="h-9"
            type="password"
            autoComplete="off"
            placeholder={gateway.webhookSecretSet?.[credentialsMode] ? 'Saved (hidden)' : 'Not set'}
            value={webhookSecret}
            onChange={(event) => setWebhookSecret(event.target.value)}
          />
        </div>
        <div className="grid gap-1 sm:grid-cols-[160px_1fr] sm:items-center">
          <label className="text-xs text-ink-600">Merchant name</label>
          <Input className="h-9" placeholder="Shown on checkout" value={merchantName} onChange={(event) => setMerchantName(event.target.value)} />
        </div>
        {webhookUrl ? (
          <div className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 text-[11px]">
            <span className="shrink-0 font-semibold text-ink-500">Webhook URL</span>
            <code className="min-w-0 flex-1 truncate text-ink-700">{webhookUrl}</code>
            <button
              type="button"
              aria-label="Copy webhook URL"
              className="rounded p-1 text-ink-500 hover:bg-surface-variant"
              onClick={() => {
                void navigator.clipboard?.writeText(webhookUrl);
                toast.success('Webhook URL copied');
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={updateMutation.isPending} onClick={saveCredentials}>
            {updateMutation.isPending ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            Save {credentialsMode.toLowerCase()} settings
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={testMutation.isPending} onClick={() => testMutation.mutate()}>
            {testMutation.isPending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            Test {credentialsMode.toLowerCase()} credentials
          </Button>
        </div>
      </div>
      {gateway.lastTestAt ? (
        <p className={`text-xs ${gateway.lastTestStatus === 'SUCCESS' ? 'text-emerald-700' : 'text-red-700'}`}>
          Last test {formatDateTime(gateway.lastTestAt)}: {gateway.lastTestMessage}
        </p>
      ) : null}
    </div>
  );
}
