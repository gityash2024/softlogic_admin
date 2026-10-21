from pathlib import Path
root=Path(__file__).resolve().parents[1]/'src'
def edit(p,fn):
 f=root/p;s=f.read_text(encoding='utf-8');f.write_text(fn(s),encoding='utf-8')

def plans(s):
 a=s.index("        {field('gstin',");b=s.index("      <div className=\"space-y-2 rounded-lg",a)
 fields=s[a:b]
 fields=fields.replace('      </div>\n      {field(\'address\', \'Seller address\')}','        {field(\'address\', \'Seller address\')}\n        </div>\n      </details>')
 s=s[:a]+'''      </div>
      <details className="ai-advanced-panel">
        <summary>Seller identity & invoice details</summary>
        <p className="mb-4 text-xs text-ink-500">These details appear on buyer invoices. Configure your legal identity before taking live payments.</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
'''+fields+s[b:]
 s=s.replace('Sell Pro credits (shows Settings › SoftLogic AI to customer, admin and partner admins while Pro is ON)', 'Enable Pro credit purchases for eligible organization and partner admins')
 s=s.replace('className="mt-1 text-xs text-ink-500">{plan.description}', 'className="ai-plan-description">{plan.description}')
 s=s.replace('<p className="text-base font-black text-ink-900">{plan.name}</p>', '<h4 className="text-ink-900">{plan.name}</h4>')
 s=s.replace('<span className="font-bold text-ink-900">{formatMinor(currency, plan.prices[currency]!.amountMinor)}</span>', '<span className="font-semibold text-ink-900"><span className="mr-2 text-[11px] font-medium text-ink-400">{currency}</span>{formatMinor(currency, plan.prices[currency]!.amountMinor)}</span>')
 s=s.replace('<p className="mt-2 text-xs text-ink-500">Valid {plan.validityMonths} months</p>', '''<p className="mt-3 text-xs text-ink-500">Valid for {plan.validityMonths} months</p>
              {plan.features.length > 0 && <ul className="mt-4 space-y-2 text-xs text-ink-600">{plan.features.map(feature => <li className="flex gap-2" key={feature}><span className="text-brand-primary" aria-hidden="true">✓</span><span>{feature}</span></li>)}</ul>}''')
 needle='  const [form, setForm] = useState<PlanForm | null>(null);'
 s=s.replace(needle,needle+'''
  const [originalPlan, setOriginalPlan] = useState('');
  const openPlan = (next: PlanForm) => { setOriginalPlan(JSON.stringify(next)); setForm(next); };
  const planDirty = form !== null && JSON.stringify(form) !== originalPlan;
  useAiDirty(planDirty, () => setForm(null));
  const closePlan = () => { if (!planDirty || window.confirm('Discard the unsaved plan changes?')) setForm(null); };''')
 s=s.replace('onClick={() => setForm(planToForm())}', 'onClick={() => openPlan(planToForm())}').replace('onClick={() => setForm(planToForm(plan))}', 'onClick={() => openPlan(planToForm(plan))}')
 s=s.replace('onOpenChange={(open) => !open && setForm(null)}','onOpenChange={(open) => !open && closePlan()}').replace('onClick={() => setForm(null)}','onClick={closePlan}')
 s=s.replace("const [merchantName, setMerchantName] = useState(String(gateway.publicConfig?.merchantName ?? ''));", "const [merchantName, setMerchantName, merchantSaved] = useAiDraft(String(gateway.publicConfig?.merchantName ?? ''));")
 a=s.index('function GatewayCard');part=s[a:];part=part.replace('onSuccess: () => {','onSuccess: () => {\n      merchantSaved();',1);s=s[:a]+part
 s=s.replace("useAiDirty(Object.values(credentials).some(value => value.trim()) || Boolean(webhookSecret.trim()) || merchantName !== String(gateway.publicConfig.merchantName ?? ''));", "useAiDirty(Object.values(credentials).some(value => value.trim()) || Boolean(webhookSecret.trim()), () => { setCredentials({}); setWebhookSecret(''); });")
 return s
edit('features/ai/tabs/AiPlansTab.tsx',plans)

def credits(s):
 s="import { useAiDirty } from '../components/ai-drafts';\n"+s
 marker='  const reclaimWallet = reclaim.target?.wallet ?? null;'
 s=s.replace(marker,"  useAiDirty(Boolean(topUp || allocation.amount || reclaim.amount), () => { setTopUp(''); setAllocation(current => ({ ...current, target: null, amount: '' })); setReclaim(current => ({ ...current, target: null, amount: '' })); });\n"+marker)
 s=s.replace('className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"','className="ai-stats-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-4"')
 s=s.replace('className="grid gap-5 xl:grid-cols-3"','className="ai-credit-actions grid gap-5 xl:grid-cols-3"')
 return s
edit('features/ai/tabs/AiCreditsTab.tsx',credits)

def tiers(s):
 s=s.replace("import { useAiDraft }", "import { useAiDirty, useAiDraft }")
 marker='  const policiesQuery = useQuery({'
 s=s.replace(marker,"  useAiDirty(Boolean(draft.target || draft.note || draft.freeDailyRequests || draft.freeDailyCredits), () => setDraft(current => ({ ...current, target: null, note: '', freeDailyRequests: '', freeDailyCredits: '' })));\n\n"+marker)
 return s
edit('features/ai/tabs/AiTiersTab.tsx',tiers)

def fields(s):
 s=s.replace("import { useEffect, useState } from 'react';", "import '../ai-workspace.css';\nimport { useAiDraft } from './ai-drafts';")
 a=s.index("  const [freeCredits, setFreeCredits]");b=s.index('  const freeMutation',a)
 s=s[:a]+'''  const policy = policyQuery.data?.data?.[0] ?? null;
  const [freeCredits, setFreeCredits, creditsSaved] = useAiDraft(String(currentAllocated));
  const [proAccess, setProAccess, policySaved] = useAiDraft<'INHERIT' | 'ON' | 'OFF'>(policy?.proEnabled === true ? 'ON' : policy?.proEnabled === false ? 'OFF' : 'INHERIT');

'''+s[b:]
 s=s.replace("toast.success('Free credits saved');", "toast.success('Free credits saved'); creditsSaved();")
 s=s.replace("toast.success('Pro access saved');", "toast.success('Pro access saved'); policySaved();")
 s=s.replace('className="space-y-3 rounded-xl border border-line bg-gradient-to-r from-sky-50/60 via-white to-sky-50/30 p-4 shadow-2xs"','className="ai-workspace space-y-4 rounded-xl border border-line bg-slate-50/60 p-5"')
 s=s.replace('<Input type="number"', '<Input aria-label="Free credits to assign" type="number"',1)
 return s
edit('features/ai/components/AiTierFormFields.tsx',fields)
edit('features/ai/components/ai-ui.tsx',lambda s:s.replace('{exact} credits</span>', '{exact}</span>'))
edit('features/ai/tabs/AiLedgerTab.tsx',lambda s:s.replace('"Credit range", "Date range"','"Credit range", "From date", "To date"').replace('placeholder="Min credits"','aria-label="Minimum credits" placeholder="Min credits"').replace('placeholder="Max credits"','aria-label="Maximum credits" placeholder="Max credits"'))
edit('components/ai/AiCreditInfoButton.tsx',lambda s:s.replace('<DialogContent className="','<DialogContent className="ai-workspace ai-dialog ').replace('<DialogContent>','<DialogContent className="ai-workspace ai-dialog">'))
edit('components/layout/AiAlertsBell.tsx',lambda s:s.replace('className="w-[340px] p-0"','className="ai-workspace w-[min(360px,calc(100vw-24px))] p-0"'))
