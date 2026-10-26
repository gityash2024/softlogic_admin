const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');
const read = name => fs.readFileSync(path.join(__dirname, '../src/features/ai', name), 'utf8');
function navigation() {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(read('components/ai-navigation.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports });
  return exports;
}
test('five groups retain every old bookmark and all focused destinations', () => {
  const nav = navigation();
  assert.equal(nav.AI_NAVIGATION.length, 5);
  for (const id of ['overview','tiers','credits','plans','organizations','users','ledger','free-health','google-billing','configuration','pricing','billing-settings','gateways','orders']) {
    assert.equal(nav.aiTab(id), id);
    assert(nav.aiGroup(id).tabs.some(tab => tab.id === id));
  }
  assert.equal(nav.aiTab('invalid'), 'overview');
});
test('focused views replace the combined billing and configuration pages', () => {
  const page = read('AiPage.tsx');
  for (const id of ['configuration','pricing','billing-settings','gateways','orders']) assert(page.includes(`value="${id}"`), id);
  assert(page.includes('AiUnsavedBoundary'));
});
test('credential fields distinguish API secrets from saved login passwords', () => {
  const plans = read('tabs/AiPlansTab.tsx');
  assert(plans.includes('new-password'));
  assert(plans.includes('data-lpignore="true"'));
});

// Run the production hook with a small synchronous Hooks dispatcher. No DOM or
// network is involved; state/effect dependencies and effect cleanup are honored.
function draftHarness(serverValue, identity) {
  const slots = [];
  let position = 0, pending = false, effects = [], result, dirty = false, discard;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const register = (_id, nextDirty, nextDiscard) => { dirty = nextDirty; discard = nextDiscard; };
  const hooks = {
    createContext: () => ({}),
    useContext: () => register,
    useId: () => hooks.useMemo(() => 'draft-section', []),
    useState(initial) {
      const index = position++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, next => {
        const value = typeof next === 'function' ? next(slots[index].value) : next;
        if (!Object.is(value, slots[index].value)) { slots[index].value = value; pending = true; }
      }];
    },
    useRef(initial) {
      const index = position++;
      if (!slots[index]) slots[index] = { current: initial };
      return slots[index];
    },
    useMemo(factory, deps) {
      const index = position++;
      if (!slots[index] || !same(slots[index].deps, deps)) slots[index] = { value: factory(), deps };
      return slots[index].value;
    },
    useCallback(callback, deps) { return hooks.useMemo(() => callback, deps); },
    useEffect(effect, deps) {
      const index = position++;
      if (!slots[index] || !same(slots[index].deps, deps)) {
        const cleanup = slots[index]?.cleanup;
        slots[index] = { deps };
        effects.push(() => { cleanup?.(); slots[index].cleanup = effect(); });
      }
    },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(read('components/ai-drafts.tsx'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => name === 'react' ? hooks : name === 'react-router-dom' ? {} : require(name) });
  const flush = () => {
    for (let render = 0; render < 30; render++) {
      pending = false; position = 0; effects = [];
      result = exports.useAiDraft(serverValue, identity);
      effects.forEach(effect => effect());
      if (!pending) return;
    }
    throw new Error('Draft hook did not settle');
  };
  flush();
  return {
    get value() { return result[0]; }, get dirty() { return dirty; },
    edit(next) { result[1](next); flush(); },
    refresh(next) { serverValue = next; flush(); },
    switchTarget(next, target) { serverValue = next; identity = target; flush(); },
    saved(snapshot, target) { result[2](snapshot, target); flush(); },
    discard() { discard(); flush(); },
  };
}

test('clean drafts hydrate new server values but refresh preserves edited values', () => {
  const form = draftHarness({ limit: 1 });
  form.refresh({ limit: 2 });
  assert.equal(form.value.limit, 2);
  form.edit({ limit: 3 });
  form.refresh({ limit: 4 });
  assert.equal(form.value.limit, 3);
  assert.equal(form.dirty, true);
  form.discard();
  assert.equal(form.value.limit, 4);
  assert.equal(form.dirty, false);
});

test('acknowledging save A cannot clear edit B or let its refetch overwrite B', () => {
  const form = draftHarness({ limit: 1 });
  form.edit({ limit: 2 });
  const submitted = form.value;
  form.edit({ limit: 3 });
  form.saved(submitted);
  form.refresh({ limit: 2 });
  assert.equal(form.value.limit, 3);
  assert.equal(form.dirty, true);
});

test('matching save clears secrets and permits clean hydration after refetch', () => {
  const form = draftHarness({ secret: '', enabled: true });
  form.edit({ secret: 'test-only-placeholder', enabled: true });
  form.saved(form.value);
  assert.equal(form.value.secret, '');
  assert.equal(form.dirty, false);
  form.refresh({ secret: '', enabled: false });
  assert.equal(form.value.enabled, false);
});

test('target identity resets drafts and rejects late acknowledgments for an old target', () => {
  const form = draftHarness({ limit: 1 }, 'org:A');
  form.edit({ limit: 2 });
  const submitted = form.value;
  form.switchTarget({ limit: 8 }, 'org:B');
  assert.equal(form.value.limit, 8);
  assert.equal(form.dirty, false);
  form.edit({ limit: 2 }); // Intentionally identical to A's submitted value.
  form.saved(submitted, 'org:A');
  form.refresh({ limit: 9 });
  assert.equal(form.value.limit, 2);
  assert.equal(form.dirty, true);
});

function presentation() {
  const React = require('react');
  const exports = {};
  const control = tag => props => React.createElement(tag, props, props.children);
  const dependencies = {
    '@/components/ui/badge': { Badge: control('span') },
    '@/components/ui/dialog': {},
    '@/components/ui/input': { Input: control('input') },
    '@/components/ui/spinner': { Spinner: control('span') },
    '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
    '@/services/ai-admin.api': { aiAdminApi: {} },
    './ai-format': { formatCredits: String, useDebouncedValue: value => value },
  };
  vm.runInNewContext(ts.transpileModule(read('components/ai-ui.tsx'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => name in dependencies ? dependencies[name] : require(name) });
  return exports;
}

test('huge summary balances retain the exact value beside a compact metric', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { AiMetricCard } = presentation();
  const html = renderToStaticMarkup(React.createElement(AiMetricCard, { label: 'Free balance', value: '11,86,91,79,40,52,530' }));
  assert.match(html, /ai-exact-number[^>]*>11,86,91,79,40,52,530/);
  assert.match(html, /title="11,86,91,79,40,52,530"/);
  assert.match(html, /118\.69T/);
});

test('persistent search labels point to the real editable input', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { AiField, DebouncedSearchInput } = presentation();
  const html = renderToStaticMarkup(React.createElement(AiField, { label: 'Search ledger' },
    React.createElement(DebouncedSearchInput, { value: 'retained search', onChange() {}, placeholder: 'Search ledger' })));
  const target = html.match(/for="([^"]+)"/)[1];
  assert(html.includes(`id="${target}"`));
  assert(html.includes('value="retained search"'));
  assert(html.includes('<span>Search ledger</span>'));
});

test('advanced filters keep range controls grouped without a nested label', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { AiFilters } = presentation();
  const html = renderToStaticMarkup(React.createElement(AiFilters, { labels: ['Search', 'Status', 'Credits'] },
    React.createElement('input', { key: 'search' }), React.createElement('select', { key: 'status' }),
    React.createElement('div', { key: 'range' }, React.createElement('input', { 'aria-label': 'Minimum credits' }), React.createElement('input', { 'aria-label': 'Maximum credits' }))));
  assert.match(html, /<details class="ai-filter-more"/);
  assert.match(html, /role="group" aria-label="Credits"/);
  assert(!html.includes('<label class="ai-field" for="undefined"'));
});

test('AI motion supports reduced motion including decorative pseudo-elements', () => {
  const root = require('postcss').parse(read('ai-workspace.css'));
  const reduced = [];
  root.walkAtRules('media', rule => { if (rule.params.includes('prefers-reduced-motion: reduce')) reduced.push(rule); });
  assert(reduced.length > 0);
  const text = reduced.map(rule => rule.toString()).join('\n');
  assert.match(text, /\.ai-workspace \*::before/);
  assert.match(text, /animation: none !important/);
  assert.match(text, /transition: none !important/);
  assert.match(text, /transform: none/);
});

test('unlimited pool presentation retains exact accounting detail', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { AiMetricCard } = presentation();
  const html = renderToStaticMarkup(React.createElement(AiMetricCard, { label: 'Pro platform pool', value: 'Unlimited',
    detail: React.createElement('span', null, 'Bookkeeping available: 11,86,91,79,40,52,530') }));
  assert.match(html, /Unlimited/);
  assert.match(html, /11,86,91,79,40,52,530/);
});


test('unlimited zero-balance wallet remains healthy while finite zero stays exhausted', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const source = fs.readFileSync(path.join(__dirname, '../src/features/settings/softlogic-ai/SoftLogicAiTab.tsx'), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => {
    if (name.endsWith('.css')) return {};
    if (name === '@/components/ui/card') return { Card: props => React.createElement('div', props, props.children) };
    if (name.includes('ai-format')) return { formatCredits: String };
    if (name === 'react' || name === 'react/jsx-runtime') return require(name);
    return {};
  }});
  const status = { unlimited: true, availableTokens: '0', allocatedTokens: '1000', usedTokens: '1000', percentRemaining: 0 };
  const render = value => renderToStaticMarkup(React.createElement(exports.BalanceCard,
    { title: 'Free', icon: null, status: value, tone: 'free' }));
  const unlimited = render(status);
  assert.match(unlimited, /Unlimited/);
  assert.match(unlimited, /width:100%/);
  assert(!unlimited.includes('bg-red-500'));
  assert.match(unlimited, /1000 used/);
  const finite = render({ ...status, unlimited: false });
  assert(!finite.includes('Unlimited'));
  assert.match(finite, /bg-red-500/);
  assert.match(finite, /width:0%/);
});

test('master mode control maps all three choices to persisted availability flags', () => {
  const config = { tiersActive: true, proGloballyEnabled: true, freeEnabled: true };
  let draft = config;
  const jsx = (type, props) => ({ type, props });
  const componentNames = new Proxy({}, { get: (_target, key) => key });
  const mocks = name => {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react') return { useState: () => [false, () => {}] };
    if (name === '@tanstack/react-query') return { useQuery: () => ({ data: config }), useQueryClient: () => ({ invalidateQueries() {} }), useMutation: () => ({ isPending: false, mutate() {} }) };
    if (name.endsWith('ai-drafts')) return { useAiDraft: () => [config, update => { draft = update(draft); }, () => {}] };
    if (name.endsWith('ai-format')) return { formatDateTime: () => '', formatCredits: () => '' };
    return componentNames;
  };
  const code = ts.transpileModule(read('tabs/AiTiersTab.tsx'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(code + '\nexports.renderMaster = TierSwitchCard;', { exports, require: mocks });
  const tree = exports.renderMaster();
  const find = node => {
    if (!node || typeof node !== 'object') return null;
    if (node.type === 'Select' && node.props.value === 'BOTH') return node;
    for (const child of [node.props?.children].flat(Infinity)) { const result = find(child); if (result) return result; }
    return null;
  };
  const select = find(tree);
  assert(select, 'Existing AI tier card must expose the master Select');
  for (const [mode, pro, free] of [['FREE_ONLY', false, true], ['PRO_ONLY', true, false], ['BOTH', true, true]]) {
    select.props.onValueChange(mode);
    assert.equal(draft.proGloballyEnabled, pro);
    assert.equal(draft.freeEnabled, free);
  }
});
