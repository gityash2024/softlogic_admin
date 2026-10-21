from pathlib import Path
root=Path(__file__).resolve().parents[1]/'src'
def put(name,s): (root/name).write_text(s,encoding='utf-8')
def read(name): return (root/name).read_text(encoding='utf-8')
p='features/ai/AiPage.tsx';s=read(p).replace("queryKey: ['ai-billing-config'], queryFn: aiBillingApi.config, enabled: isSuperAdmin", "queryKey: ['ai-billing-gateways'], queryFn: aiBillingApi.gateways, enabled: isSuperAdmin")
s=s.replace('billingModeQuery.data?.effectiveMode','billingModeQuery.data?.[0]?.effectiveMode').replace('billingModeQuery.data.effectiveMode','billingModeQuery.data[0].effectiveMode')
put(p,s)
for name in ['AiCreditsTab','AiUsageOverview']:
 p=f'features/ai/tabs/{name}.tsx';s=read(p).replace("import { StatCard } from '@/features/admin/admin-list-ui';", "import { AiMetricCard as StatCard } from '../components/ai-ui';")
 s=s.replace('className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"','className="ai-stats-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-3"')
 s=s.replace('className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"','className="ai-stats-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-4"')
 if name=='AiCreditsTab':
  s=s.replace('className="grid gap-5 lg:grid-cols-3"','className="ai-credit-actions grid gap-5 lg:grid-cols-3"')
  s=s.replace('className="grid gap-5 lg:grid-cols-2"','className="ai-credit-actions grid gap-5 lg:grid-cols-2"')
 else:
  s=s.replace('per-tier KPIs and usage charts (additive, below the existing cards).','per-tier KPIs and usage charts.')
  s=s.replace('title="Free & Pro usage"','title="Usage at a glance"')
  s=s.replace("'Tiers are active. Pro is switched ON.'", "'Online Free, Pro and on-device activity in one place.'")
  s=s.replace('fill={PALETTE[index % PALETTE.length]}', "fill={series === 'FREE' ? '#1149B5' : series === 'PRO' ? '#7C3AED' : PALETTE[index % PALETTE.length]}")
  s=s.replace('stroke={PALETTE[index % PALETTE.length]}', "stroke={series === 'FREE' ? '#1149B5' : series === 'PRO' ? '#7C3AED' : PALETTE[index % PALETTE.length]}")
  s=s.replace('className="rounded-lg border border-line bg-white px-3 py-3"','className="min-w-0 rounded-xl border border-line bg-white p-5"')
 put(p,s)

labels={
 'AiOrganizationsTab':['Search organizations','Organization kind','Status','Wallet tier','Wallet health','Pro policy'],
 'AiUsersTab':['Search users','Organization','Role','Status','Wallet tier','Wallet health','Funding source'],
 'AiLedgerTab':['Search ledger','Transaction type','Direction','Tier','Model','Feature or tool','Provider','Credit range','Date range'],
 'AiOrdersPanel':['Search orders','Status','Gateway','Payment mode','Date range'],
}
import json
for name,fields in labels.items():
 p=f'features/ai/tabs/{name}.tsx';s=read(p)
 a=s.index('      <div className="grid gap-3 rounded-lg border border-line bg-surface-variant p-3')
 b=s.index('      <ActiveFilterChips',a)
 block=s[a:b]; op=block.index('>'); end=block.rindex('</div>')
 block='      <AiFilters labels={'+json.dumps(fields)+'}>'+block[op+1:end]+'</AiFilters>\n'
 s=s[:a]+block+s[b:]
 s="import { AiFilters } from '../components/ai-ui';\n"+s
 put(p,s)

p='features/settings/softlogic-ai/SoftLogicAiTab.tsx';s=read(p)
s="import '@/features/ai/ai-workspace.css';\n"+s
s=s.replace('className="space-y-5"','className="ai-workspace space-y-6"',1)
s=s.replace('className="grid gap-4 lg:grid-cols-3"','className="ai-stats-grid grid gap-4 lg:grid-cols-3"')
s=s.replace('<h3 className="text-xl font-black text-ink-900">Buy {storefront.brand.pro} credits</h3>','<p className="ai-eyebrow">PLANS & CREDITS</p><h3 className="mt-2 text-2xl font-bold text-ink-900">A plan for every classroom</h3>')
s=s.replace('className="mt-2 text-2xl font-black text-ink-900"','className="ai-metric-value mt-3"')
s=s.replace('type="button"\n                onClick={() => setCurrency(option)}','type="button" aria-pressed={currency === option}\n                onClick={() => setCurrency(option)}')
put(p,s)

p='features/ai/tabs/AiPlansTab.tsx';s=read(p).replace('className="grid gap-4 xl:grid-cols-2"','className="ai-provider-grid grid gap-5 xl:grid-cols-2"')
put(p,s)

# Dialogs live in Radix portals, outside the page's CSS scope.
for folder in ['features/ai','features/settings/softlogic-ai']:
 for p in (root/folder).rglob('*.tsx'):
  if p.name=='ai-ui.tsx': continue
  s=p.read_text(encoding='utf-8')
  s=s.replace('<DialogContent className="','<DialogContent className="ai-workspace ai-dialog ')
  s=s.replace('<DialogContent>','<DialogContent className="ai-workspace ai-dialog">')
  p.write_text(s,encoding='utf-8')

p='components/layout/Topbar.tsx';s=read(p)
s=s.replace("subtitle: 'Master key, AI credits, and live usage'", "subtitle: 'Access, credits and AI operations'")
s=s.replace('<span className="hidden rounded-full border border-brand-primary/15 bg-brand-primary/10 px-2 py-0.5 text-xs font-semibold text-brand-primary sm:inline-flex">\n                Live\n              </span>', '{location.pathname !== \'/ai\' && <span className="hidden rounded-full border border-brand-primary/15 bg-brand-primary/10 px-2 py-0.5 text-xs font-semibold text-brand-primary sm:inline-flex">Live</span>}')
put(p,s)
