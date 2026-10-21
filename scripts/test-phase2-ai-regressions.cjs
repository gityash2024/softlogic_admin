const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const root = path.resolve(__dirname, '..');
const checkoutPath = 'src/features/settings/softlogic-ai/checkout.ts';
const summaryPath = 'src/features/settings/softlogic-ai/OrderSummaryDialog.tsx';

function renderUserWallets(role, hasWallet = true) {
  const wrapper = ({ children }) => React.createElement('div', null, children);
  const wallet = { accountId: 'wallet', tier: 'PRO', allocatedTokens: 26800000, usedTokens: 19688375,
    reservedTokens: 0, childAllocatedTokens: 0, availableTokens: 7111625, percentRemaining: 26.53,
    unlimited: false, status: 'ACTIVE', health: 'HEALTHY' };
  const row = { id: 'user', email: 'fixture@example.test', name: 'Fixture', role, status: 'ACTIVE',
    primaryOrganization: null, createdAt: '2026-10-21', preferredTier: null, tierPolicy: null,
    wallets: { PRO: hasWallet ? wallet : null, FREE: hasWallet ? { ...wallet, tier: 'FREE' } : null },
    usesOrgPool: { PRO: !hasWallet, FREE: !hasWallet } };
  const ui = loadModule('src/features/ai/components/ai-ui.tsx', {
    '@/components/ui/badge': { Badge: wrapper }, '@/components/ui/dialog': {},
    '@/components/ui/input': {}, '@/components/ui/spinner': {}, '@/lib/utils': { cn: (...parts) => parts.join(' ') },
    '@/services/ai-admin.api': {}, './ai-format': { formatCredits: value => value.toLocaleString('en-IN') },
  });
  const listParams = { useAiListParams: () => ({ values: {}, page: 1, set() {}, setMany() {}, clear() {}, chips: () => [] }) };
  const common = {
    '@/components/ui/button': { Button: wrapper }, '@/components/ui/card': { Card: wrapper },
    '@/features/admin/admin-list-ui': {}, '@/lib/api': {}, '@/services/ai-admin.api': {},
    '../components/BulkAllocateDialog': {}, '../components/ai-ui': ui,
    '../components/ai-format': { formatDateTime: String }, '../components/useAiListParams': listParams,
  };
  const { WalletDetail } = loadModule('src/features/ai/tabs/AiOrganizationsTab.tsx', { ...common, '@/components/ui/select': {} });
  const displayUi = { ...ui, AiFilters: () => null, DetailDrawer: wrapper, SectionHeader: () => null };
  const { AiUsersTab } = loadModule('src/features/ai/tabs/AiUsersTab.tsx', {
    ...common, '../components/ai-ui': displayUi, './AiOrganizationsTab': { WalletDetail, FilterSelect: () => null },
    '@/features/admin/admin-list-ui': { ActiveFilterChips: () => null, ExportButtons: () => null, PaginationFooter: () => null },
    '../components/BulkAllocateDialog': { BulkAllocateDialog: () => null },
    '@tanstack/react-query': { useQuery: () => ({ data: { data: [row] } }) },
    react: { ...React, useState: initial => [initial === null ? row : typeof initial === 'function' ? initial() : initial, () => {}] },
  });
  return renderToStaticMarkup(React.createElement(AiUsersTab));
}

test('Superadmin Free and Pro wallet rows and details show Unlimited while preserving recorded usage', () => {
  const markup = renderUserWallets('SUPER_ADMIN');
  assert.ok((markup.match(/Unlimited/g) ?? []).length >= 8);
  assert.doesNotMatch(markup, /Healthy|26\.53%|2,68,00,000|71,11,625/);
  assert.match(markup, /1,96,88,375/);
});

test('Superadmin remains Unlimited without a personal wallet; other users still use their organization pool', () => {
  const superadmin = renderUserWallets('SUPER_ADMIN', false);
  assert.match(superadmin, /Unlimited/);
  assert.doesNotMatch(superadmin, /Uses org pool|No wallet yet|Pro: org pool|Free: org pool/);
  const teacher = renderUserWallets('TEACHER', false);
  assert.match(teacher, /Uses org pool/);
  assert.match(teacher, /No wallet yet/);
  assert.doesNotMatch(teacher, /Unlimited/);
});

test('other account roles keep numeric wallet balances and health percentages', () => {
  for (const role of ['PARTNER_ADMIN', 'CUSTOMER_ADMIN', 'ADMIN', 'TEACHER']) {
    const markup = renderUserWallets(role);
    assert.match(markup, /Healthy - 26\.53%/, role);
    assert.match(markup, /2,68,00,000/, role);
    assert.match(markup, /71,11,625/, role);
    assert.doesNotMatch(markup, /Unlimited/, role);
  }
});

function readSource(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function transpile(source) {
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
}

function loadModule(relative, dependencies = {}, globals = {}) {
  const sandbox = {
    exports: {},
    require(name) {
      if (name in dependencies) return dependencies[name];
      if (!name.startsWith('@/') && !name.startsWith('./') && !name.startsWith('../')) return require(name);
      throw new Error(`Unexpected dependency in ${relative}: ${name}`);
    },
    ...globals,
  };
  vm.runInNewContext(transpile(readSource(relative)), sandbox, { filename: relative });
  return sandbox.exports;
}

function parsed(relative) {
  return ts.createSourceFile(relative, readSource(relative), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function findNode(relative, matches) {
  let found;
  function visit(node) {
    if (matches(node)) found = node;
    ts.forEachChild(node, visit);
  }
  visit(parsed(relative));
  assert.ok(found, `Source node missing in ${relative}`);
  return found;
}

function mutationCallback(relative, variable, property, globals, args = []) {
  const node = findNode(relative, (item) => ts.isVariableDeclaration(item) && item.name.getText() === variable);
  const callback = node.initializer.arguments[0].properties.find((item) => item.name?.getText() === property);
  assert.ok(callback, `${variable}.${property} missing`);
  return vm.runInNewContext(transpile(`(${callback.initializer.getText()})(...args)`), { ...globals, args });
}

function checkoutFixture() {
  const values = new Map();
  const redirects = [];
  let serial = 0;
  const window = {
    sessionStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
    localStorage: { setItem() {} },
    location: { assign: (url) => redirects.push(url) },
  };
  const globals = { window, crypto: { randomUUID: () => `attempt-${++serial}` } };
  const reload = () => loadModule(checkoutPath, { '@/services/ai-billing.api': { aiBillingApi: {} } }, globals);
  return { checkout: reload(), reload, window, values, redirects };
}

test('redirect checkout survives refresh and terminal acknowledgement starts a new attempt', async () => {
  const fixture = checkoutFixture();
  const first = fixture.checkout.idempotencyKeyFor('plan');
  fixture.checkout.bindCheckoutToOrder('plan', 'order-1');
  await fixture.checkout.launchCheckout({ gateway: 'STRIPE' }, { kind: 'redirect', redirectUrl: 'https://checkout.example.test' }, 'SoftLogic AI Pro');
  assert.equal(fixture.redirects.length, 1);
  const afterReturn = fixture.reload();
  assert.equal(afterReturn.idempotencyKeyFor('plan'), first);
  afterReturn.clearCheckoutForOrder('order-1');
  assert.notEqual(afterReturn.idempotencyKeyFor('plan'), first);
});

test('an old order cannot clear a newer attempt for the same plan', () => {
  const { checkout } = checkoutFixture();
  checkout.idempotencyKeyFor('plan');
  checkout.bindCheckoutToOrder('plan', 'old-order');
  checkout.clearIdempotencyKey('plan');
  const newer = checkout.idempotencyKeyFor('plan');
  checkout.clearCheckoutForOrder('old-order');
  assert.equal(checkout.idempotencyKeyFor('plan'), newer);
});

test('order summary preserves pending, dismissed and failed-network checkout identities', () => {
  const { checkout } = checkoutFixture();
  const first = checkout.idempotencyKeyFor('plan');
  checkout.bindCheckoutToOrder('plan', 'pending');
  const completed = [];
  const globals = { ...checkout, onCompleted: (order) => completed.push(order), toast: { message() {}, error() {} }, extractApiError: String };
  const success = (outcome) => mutationCallback(summaryPath, 'payMutation', 'onSuccess', globals, [{ outcome }]);
  success({ kind: 'dismissed' });
  success({ kind: 'redirected' });
  mutationCallback(summaryPath, 'payMutation', 'onError', globals, [new Error('response lost')]);
  success({ kind: 'completed', order: { id: 'pending', status: 'PENDING' } });
  assert.equal(checkout.idempotencyKeyFor('plan'), first);
  assert.equal(completed.length, 1);
  success({ kind: 'completed', order: { id: 'pending', status: 'FULFILLED' } });
  assert.notEqual(checkout.idempotencyKeyFor('plan'), first);
});

test('terminal existing orders never reopen their old payment URL', async () => {
  for (const status of ['FULFILLED', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'PARTIALLY_REFUNDED']) {
    const { checkout, window } = checkoutFixture();
    const first = checkout.idempotencyKeyFor('plan');
    let launches = 0;
    const order = { id: 'settled', status };
    const result = await mutationCallback(summaryPath, 'payMutation', 'mutationFn', {
      ...checkout, window, quotePayload: { planId: 'p' }, gateway: 'STRIPE', currency: 'INR', selectionKey: 'plan',
      BILLING_STORAGE_KEY: 'test', details: { gstin: '', legalName: '', state: '', address: '' }, storefront: { brand: { pro: 'SoftLogic AI Pro' } },
      aiBillingApi: { createOrder: async () => ({ order, checkout: { kind: 'redirect', redirectUrl: 'old-url' } }) },
      launchCheckout: async () => { launches++; },
    });
    assert.equal(launches, 0, status);
    assert.equal(result.outcome.kind, 'completed');
    assert.notEqual(checkout.idempotencyKeyFor('plan'), first, status);
  }
});

test('only settled payment statuses end a checkout attempt', () => {
  const { checkout } = checkoutFixture();
  for (const status of ['CREATED', 'PENDING', 'PAID', 'REFUND_PENDING']) assert.equal(checkout.isCheckoutTerminal(status), false, status);
  for (const status of ['FULFILLED', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'PARTIALLY_REFUNDED']) assert.equal(checkout.isCheckoutTerminal(status), true, status);
});

test('payment handoff releases the dialog focus and pointer lock until checkout finishes', () => {
  const dialog = findNode(summaryPath, (item) => ts.isJsxOpeningElement(item) && item.tagName.getText() === 'Dialog');
  const modal = dialog.attributes.properties.find((item) => item.name?.getText() === 'modal');
  const value = (isPending) => modal
    ? vm.runInNewContext(transpile(modal.initializer.expression.getText()), { payMutation: { isPending } })
    : true;
  assert.equal(value(false), true);
  assert.equal(value(true), false, 'Third-party checkout must receive pointer and keyboard input');
  assert.equal(value(false), true);
});

test('bulk SET requires an explicit amount while allowing an explicit zero', () => {
  const relative = 'src/features/ai/components/BulkAllocateDialog.tsx';
  function allocate(amount, defaultAmount = '', mode = 'SET') {
    return mutationCallback(relative, 'mutation', 'mutationFn', {
      rows: [{ scope: 'USER', userId: 'teacher', amount }], defaultAmount, mode, tier: 'FREE', reason: '',
      aiAdminApi: { bulkAllocate: (payload) => payload },
    });
  }
  for (const invalid of ['', ' ', '-1', 'Infinity', 'NaN', '9007199254740992']) assert.throws(() => allocate(invalid), undefined, invalid);
  assert.equal(allocate('0').items[0].amountTokens, 0);
  assert.equal(allocate('', '0').items[0].amountTokens, 0);
  assert.equal(allocate('', '25').items[0].amountTokens, 25);
  assert.equal(allocate('10', '25').items[0].amountTokens, 10);
  assert.throws(() => allocate('0', '', 'ADD'));
});

test('tier switch clears the selected reclaim wallet and amount', () => {
  const relative = 'src/features/ai/tabs/AiCreditsTab.tsx';
  const toggle = findNode(relative, (item) => ts.isJsxSelfClosingElement(item) && item.tagName.getText() === 'TierToggle');
  const callback = toggle.attributes.properties.find((item) => item.name?.getText() === 'onChange').initializer.expression;
  let tier = 'FREE';
  let reclaim = { scope: 'USER', target: { wallet: { availableTokens: 999 } }, amount: '500' };
  vm.runInNewContext(transpile(`(${callback.getText()})('PRO')`), {
    setTier: (next) => { tier = next; }, setReclaim: (update) => { reclaim = update(reclaim); },
  });
  assert.equal(tier, 'PRO');
  assert.equal(reclaim.target, null);
  assert.equal(reclaim.amount, '');
  assert.equal(reclaim.scope, 'USER');
});

test('flavor identity is canonical for Free and Pro and excludes provider names', () => {
  const brand = loadModule('src/lib/ai-branding.ts');
  for (const [brandingMode, product] of [['SOFTLOGIC', 'SoftLogic AI'], ['WHITE_LABEL', 'AI Smart Board AI']]) {
    const labels = brand.aiBrandLabelsForOrganization({ brandingMode });
    assert.equal(labels.product, product);
    assert.equal(labels.free, `${product} Free`);
    assert.equal(labels.pro, `${product} Pro`);
    assert.doesNotMatch(Object.values(labels).join(' '), /Gemini|Google|Qwen|Colladome/i);
    assert.equal(brand.aiBrandLabelsForUser({ primaryOrganization: { brandingMode } }).product, product);
  }
});

test('refunded checkout returns render a settled state and acknowledge the bound order', () => {
  for (const [status, label] of [['REFUNDED', 'Payment refunded'], ['PARTIALLY_REFUNDED', 'Payment partially refunded']]) {
    const effects = [];
    const cleared = [];
    const order = { id: 'returned', status, orderNumber: 'ORDER', currency: 'INR', totalMinor: 100, creditsToGrant: 50 };
    const button = ({ children }) => React.createElement('button', null, children);
    const icon = () => React.createElement('span');
    const module = loadModule('src/features/settings/softlogic-ai/CheckoutReturn.tsx', {
      react: { useEffect: (effect) => effects.push(effect), useRef: () => ({ current: false }), useState: (value) => [value, () => {}] },
      '@tanstack/react-query': { useQuery: () => ({ data: order }), useQueryClient: () => ({ invalidateQueries() {} }) },
      'lucide-react': { CheckCircle2: icon, Clock: icon, FileText: icon, XCircle: icon },
      '@/components/ui/button': { Button: button }, '@/components/ui/spinner': { Spinner: () => React.createElement('span', null, 'PAYMENT_SPINNER') },
      '@/features/ai/components/ai-billing-utils': { openReceipt() {} },
      '@/features/ai/components/ai-format': { formatCredits: String, formatMinor: () => 'INR 1' },
      '@/lib/api': { extractApiError: String }, '@/services/ai-billing.api': { aiBillingApi: {} },
      './checkout': { isCheckoutTerminal: () => true, clearCheckoutForOrder: (id) => cleared.push(id) },
    });
    const html = renderToStaticMarkup(module.CheckoutReturn({ orderId: order.id, cancelled: false, onDone() {} }));
    assert.match(html, new RegExp(label));
    assert.doesNotMatch(html, /PAYMENT_SPINNER|Confirming your payment|Still waiting/);
    assert.match(html, />Done</);
    const cleanup = effects.find((effect) => effect.toString().includes('clearCheckoutForOrder'));
    assert.ok(cleanup);
    cleanup();
    assert.deepEqual(cleared, [order.id]);
  }
});

test('every terminal checkout refreshes buyer history and balances', () => {
  const { checkout } = checkoutFixture();
  const relative = 'src/features/settings/softlogic-ai/CheckoutReturn.tsx';
  const effect = findNode(relative, item => ts.isCallExpression(item) && item.expression.getText() === 'useEffect'
    && item.arguments[0]?.getText().includes("['ai-billing-storefront']"));
  for (const status of ['FULFILLED', 'CANCELLED', 'FAILED', 'EXPIRED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'PENDING']) {
    const keys = [];
    vm.runInNewContext(transpile(`(${effect.arguments[0].getText()})()`), {
      order: { id: 'qa-order', status }, isCheckoutTerminal: checkout.isCheckoutTerminal,
      queryClient: { invalidateQueries: ({ queryKey }) => keys.push(queryKey.join(':')) },
    });
    assert.deepEqual(keys, status === 'PENDING' ? [] : ['ai-billing-storefront', 'ai-billing-buyer-orders'], status);
  }
});

test('bulk allocation keeps its submitted rows and dialog stable until results arrive', () => {
  const relative = 'src/features/ai/components/BulkAllocateDialog.tsx';
  const dialog = findNode(relative, item => ts.isJsxOpeningElement(item) && item.tagName.getText() === 'Dialog');
  const handler = dialog.attributes.properties.find(item => item.name?.getText() === 'onOpenChange').initializer.expression;
  const closed = [];
  const mutation = { isPending: true };
  const attempt = value => vm.runInNewContext(transpile(`(${handler.getText()})(value)`), { mutation, value, onOpenChange: next => closed.push(next) });
  attempt(false);
  assert.equal(closed.length, 0);
  mutation.isPending = false;
  attempt(false);
  assert.deepEqual(closed, [false]);
  const fieldset = findNode(relative, item => ts.isJsxOpeningElement(item) && item.tagName.getText() === 'fieldset');
  const disabled = fieldset.attributes.properties.find(item => item.name?.getText() === 'disabled').initializer.expression;
  mutation.isPending = true;
  assert.equal(vm.runInNewContext(disabled.getText(), { mutation }), true);
});
