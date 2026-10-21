from pathlib import Path
root = Path(__file__).resolve().parents[1]
def edit(name, transform):
    p = root / 'src' / name
    before = p.read_text(encoding='utf-8')
    after = transform(before)
    assert after != before, name
    p.write_text(after, encoding='utf-8')

def page(s):
    s = s.replace("import { aiApi }", "import './ai-workspace.css';\nimport { AI_NAVIGATION, aiTab, aiGroup } from './components/ai-navigation';\nimport { AiUnsavedBoundary, useAiDraft } from './components/ai-drafts';\nimport { aiAdminApi } from '@/services/ai-admin.api';\nimport { aiBillingApi } from '@/services/ai-billing.api';\nimport { FreePricingCard } from './tabs/AiTiersTab';\nimport { aiApi }")
    a=s.index('const AI_TABS ='); b=s.index('const pricingRowFromSummary',a)
    s=s[:a]+s[b:]
    s=s.replace('export function AiPage() {', 'export function AiPage() { return <AiUnsavedBoundary><AiPageContent /></AiUnsavedBoundary>; }\n\nfunction AiPageContent() {')
    a=s.index('  const overviewQuery = useQuery('); b=s.index('\n\n  useEffect',a)
    query=s[a:b]; s=s[:a]+s[b:]
    pos=s.index("  const [configForm, setConfigForm]")
    s=s[:pos]+query+"\n  const tierSummaryQuery = useQuery({ queryKey: ['ai-summary'], queryFn: aiAdminApi.summary });\n  const billingModeQuery = useQuery({ queryKey: ['ai-billing-config'], queryFn: aiBillingApi.config, enabled: isSuperAdmin });\n"+s[pos:]
    s=s.replace("const [configForm, setConfigForm] = useState({", "const [configForm, setConfigForm, configSaved] = useAiDraft({")
    s=s.replace('    enabled: true,\n    googleSearchGroundingEnabled: false,', '    enabled: overviewQuery.data?.config.enabled ?? true,\n    googleSearchGroundingEnabled: overviewQuery.data?.config.googleSearchGroundingEnabled ?? false,',1)
    s=s.replace('const [pricingForm, setPricingForm] = useState<PricingFormRow[]>([]);', 'const [pricingForm, setPricingForm, pricingSaved] = useAiDraft<PricingFormRow[]>((overviewQuery.data?.pricing ?? []).map(pricingRowFromSummary));')
    s=s.replace('const [billingForm, setBillingForm] = useState({', 'const billing = overviewQuery.data?.googleBilling?.config;\n  const [billingForm, setBillingForm, billingSaved] = useAiDraft({')
    for old,new in [('enabled: false','enabled: billing?.enabled ?? false'),("projectId: 'softlogic-496310'","projectId: billing?.projectId ?? ''"),("billingTableProjectId: ''","billingTableProjectId: billing?.billingTableProjectId ?? ''"),("billingDatasetId: ''","billingDatasetId: billing?.billingDatasetId ?? ''"),("billingTableName: ''","billingTableName: billing?.billingTableName ?? ''"),("monthlyCapUsd: '50'","monthlyCapUsd: String((billing?.monthlyCapMicros ?? 50_000_000) / 1_000_000)")]:
        s=s.replace(old,new,1)
    a=s.index('  useEffect(() => {\n    const config = overviewQuery.data?.config;'); b=s.index('  const configMutation',a)
    s=s[:a]+s[b:]
    s=s.replace("      setConfigForm((current) => ({ ...current, geminiApiKey: '' }));", "      setConfigForm((current) => ({ ...current, geminiApiKey: '' }));\n      configSaved();")
    s=s.replace("toast.success('AI pricing saved');", "toast.success('AI pricing saved');\n      pricingSaved();")
    s=s.replace("toast.success('Google billing verification saved');", "toast.success('Google billing verification saved');\n      billingSaved();")
    s=s.replace("  const requestedTab = searchParams.get('tab') as AiTab | null;\n  const activeTab: AiTab = requestedTab && AI_TABS.includes(requestedTab) ? requestedTab : 'overview';", "  const activeTab = aiTab(searchParams.get('tab'));\n  const activeGroup = aiGroup(activeTab);")
    a=s.index('      <TabsContent value="overview"'); b=s.index('      <TabsContent value="tiers">',a)
    old=s[a:b]
    ca=old.index('        <Card data-tour='); pa=old.index('          <div className="space-y-3 border-t'); cb=old.index('        </Card>',pa)
    config=old[ca:pa]+'        </Card>'
    pricing=old[pa:cb]
    la=old.index('        <Card className="space-y-4',cb); lb=old.index('\n      </div>\n\n      <AiUsageOverview',la)
    legacy=old[la:lb]
    replacement='''      <TabsContent value="overview"><AiUsageOverview /></TabsContent>
      <TabsContent value="configuration" className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard icon={KeyRound} label="Pro provider key" value={data.config.hasGeminiApiKey ? 'Configured' : 'Missing'} detail={data.config.maskedGeminiApiKey ?? 'No master key'} />
          <MetricCard icon={CheckCircle2} label="AI service" value={data.config.enabled ? 'Enabled' : 'Disabled'} detail={data.config.lastTestStatus ?? 'Not tested'} />
        </div>
'''+config+'''
      </TabsContent>
      <TabsContent value="pricing" className="space-y-5">
        <Card className="space-y-4 px-4 py-5 sm:px-6">'''+pricing+'''</Card>
        <FreePricingCard />
      </TabsContent>
'''
    s=s[:a]+replacement+s[b:]
    s=s.replace('<AiCreditsTab isSuperAdmin={isSuperAdmin} />', "{tierSummaryQuery.data?.tiersActive === false ? (<>"+legacy+"</>) : <AiCreditsTab isSuperAdmin={isSuperAdmin} />}")
    s=s.replace('<AiPlansTab />', '<AiPlansTab view="plans" />')
    s=s.replace('      <TabsContent value="organizations">', '''      <TabsContent value="billing-settings"><AiPlansTab view="billing-settings" /></TabsContent>
      <TabsContent value="gateways"><AiPlansTab view="gateways" /></TabsContent>
      <TabsContent value="orders"><AiPlansTab view="orders" /></TabsContent>
      <TabsContent value="organizations">''')
    a=s.index('      <Tabs value='); b=s.index('\n\n      <TabsContent',a)
    s=s[:a]+'''      <Tabs value={activeTab} onValueChange={changeTab}>
        <nav className="ai-primary-nav" aria-label="AI workspace">
          {AI_NAVIGATION.map(group => <button key={group.label} type="button" aria-current={activeGroup.label === group.label ? 'page' : undefined} onClick={() => changeTab(group.tabs[0].id)}>{group.label}</button>)}
        </nav>
        <TabsList className="ai-secondary-nav" aria-label={activeGroup.label}>
          {activeGroup.tabs.filter(tab => tab.id !== 'google-billing' || (isSuperAdmin && data.googleBilling)).map(tab => <TabsTrigger key={tab.id} value={tab.id}>{tab.label}</TabsTrigger>)}
        </TabsList>'''+s[b:]
    s=s.replace('<div className="space-y-5">\n      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">', '<div className="ai-workspace space-y-6">\n      <div className="ai-page-heading">',1)
    s=s.replace('<h2 className="text-2xl font-black text-ink-900">AI</h2>', '<p className="ai-eyebrow">AI WORKSPACE</p><h2 className="text-2xl font-bold text-ink-900">{activeGroup.tabs.find(tab => tab.id === activeTab)?.label}</h2>')
    s=s.replace('Central Gemini key, AI credits, live usage, and hierarchy allocations.', 'Manage access, monitor usage and keep every AI credit accounted for.')
    s=s.replace('        <Button variant="outline" onClick={() => overviewQuery.refetch()}>', '''        <div className="flex flex-wrap items-center gap-3">
          <span className="ai-service-pill">{data.config.enabled ? 'Service enabled' : 'Service disabled'}</span>
          {billingModeQuery.data?.effectiveMode && <span className="ai-mode-pill">{billingModeQuery.data.effectiveMode === 'TEST' ? 'Test payments' : 'Live payments'}</span>}
        <Button variant="outline" onClick={() => overviewQuery.refetch()}>''',1)
    s=s.replace('          Refresh\n        </Button>\n      </div>', '          Refresh\n        </Button></div>\n      </div>',1)
    s=s.replace('className="truncate text-lg font-black text-ink-900"', 'className="ai-metric-value" title={value}')
    s=s.replace('className="truncate text-xs text-ink-500"', 'className="break-words text-xs text-ink-500"')
    s=s.replace('type="password"\n                  placeholder=', 'type="password" autoComplete="new-password" data-lpignore="true" name="ai_provider_secret"\n                  placeholder=')
    return s
edit('features/ai/AiPage.tsx',page)

def tiers(s):
    s=s.replace("import { useEffect, useState }", "import { useState }")
    s=s.replace("const CHAIN:","const CHAIN:")
    s=s.replace("import { Card }", "import { useAiDraft } from '../components/ai-drafts';\nimport { Card }")
    s=s.replace('      <FreePricingCard />\n','')
    s=s.replace('      <ConversionPreviewCard />', '      <details className="ai-advanced-panel"><summary>Release conversion checks</summary><ConversionPreviewCard /></details>')
    a=s.index('  const [form, setForm] = useState<AiTierConfig | null>'); b=s.index('  const saveMutation',a)
    s=s[:a]+"  const [form, setForm, formSaved] = useAiDraft<AiTierConfig | null>(configQuery.data ?? null);\n  const [confirmOff, setConfirmOff] = useState(false);\n\n"+s[b:]
    s=s.replace("toast.success('Tier settings saved');", "toast.success('Tier settings saved');\n      formSaved();")
    s=s.replace('function FreePricingCard()', 'export function FreePricingCard()')
    a=s.index('  const [rows, setRows] = useState<FreePricingForm[]>'); b=s.index('  const saveMutation',a)
    s=s[:a]+'''  const [rows, setRows, pricingSaved] = useAiDraft<FreePricingForm[]>((pricingQuery.data ?? []).map(row => ({
    id: row.id, modelId: row.modelId, billingType: row.billingType, enabled: row.enabled,
    input: microsToInput(row.inputUsdMicrosPerMillion), output: microsToInput(row.outputUsdMicrosPerMillion),
    image: microsToInput(row.imageUsdMicrosEach), audio: microsToInput(row.audioUsdMicrosEach), search: microsToInput(row.searchUsdMicrosPerThousand),
  })));

'''+s[b:]
    s=s.replace("toast.success('Free AI pricing saved');", "toast.success('Free AI pricing saved');\n      pricingSaved();")
    s=s.replace('Separate from the Pro model pricing on the Overview tab.', 'Rates are separate from the Pro model pricing above.')
    return s
edit('features/ai/tabs/AiTiersTab.tsx',tiers)

def plans(s):
    s=s.replace("import { useEffect, useState }", "import { useState }")
    s=s.replace("import { Badge }", "import { useAiDraft, useAiDirty } from '../components/ai-drafts';\nimport { Badge }")
    s=s.replace('export function AiPlansTab() {', "export function AiPlansTab({ view = 'plans' }: { view?: 'plans' | 'billing-settings' | 'gateways' | 'orders' }) {")
    s=s.replace('          <BillingConfigCard config={configQuery.data} />\n          <PlansCard config={configQuery.data} />\n          <GatewaysCard />\n          <AiOrdersPanel />', '''          {view === 'billing-settings' && <BillingConfigCard config={configQuery.data} />}
          {view === 'plans' && <PlansCard config={configQuery.data} />}
          {view === 'gateways' && <GatewaysCard />}
          {view === 'orders' && <AiOrdersPanel />}''')
    a=s.index('  const [form, setForm] = useState<ConfigForm>'); b=s.index('  const mutation =',a)
    s=s[:a]+"  const [form, setForm, formSaved] = useAiDraft<ConfigForm>(toConfigForm(config));\n\n"+s[b:]
    # Exact toast name differs across older snapshots.
    a=s.index('function BillingConfigCard'); b=s.index('type PlanForm',a)
    block=s[a:b]; block=block.replace('onSuccess: () => {', 'onSuccess: () => {\n      formSaved();',1); s=s[:a]+block+s[b:]
    s=s.replace('className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"', 'className="ai-plan-grid"')
    s=s.replace('className={`relative rounded-xl border px-4 py-4 ', 'className={`ai-plan-card relative rounded-xl border px-4 py-4 ')
    s=s.replace('className="flex justify-between gap-2"', 'className="ai-catalog-price"')
    s=s.replace('className="mt-3 flex flex-wrap gap-1"', 'className="mt-auto flex flex-wrap gap-2 pt-5"')
    s=s.replace('className="space-y-3 rounded-xl border border-line bg-white px-4 py-4"', 'className="ai-gateway-card space-y-4 rounded-xl border border-line bg-white px-5 py-5"')
    s=s.replace('autoComplete="off"', 'autoComplete="new-password" data-lpignore="true" data-1p-ignore="true"')
    s=s.replace('type={fieldDef.secret ? \'password\' : \'text\'}', "type={fieldDef.secret ? 'password' : 'text'}\n              name={`ai_${gateway.gateway}_${credentialsMode}_${fieldDef.key}`}")
    s=s.replace('            value={webhookSecret}', '            name={`ai_${gateway.gateway}_webhook_secret`}\n            value={webhookSecret}')
    s=s.replace('className="min-w-0 flex-1 truncate text-ink-700"', 'className="min-w-0 flex-1 break-all text-ink-700"')
    marker="  const saved = gateway.credentials?.[credentialsMode] ?? {};"
    s=s.replace(marker,"  useAiDirty(Object.values(credentials).some(value => value.trim()) || Boolean(webhookSecret.trim()) || merchantName !== String(gateway.publicConfig.merchantName ?? ''));\n"+marker)
    return s
edit('features/ai/tabs/AiPlansTab.tsx',plans)
