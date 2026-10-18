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
