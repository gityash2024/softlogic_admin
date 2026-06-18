const generatedActivationKeyPattern = /^SL[A-F0-9]{24}$/;
const canonicalActivationKeyPattern = /^SL-[A-F0-9]{24}$/;

function chunk(value: string, size: number) {
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += size) {
    chunks.push(value.slice(index, index + size));
  }
  return chunks;
}

export function normalizeActivationKey(value: string | null | undefined) {
  const trimmed = String(value ?? '').trim();
  const compact = trimmed.toUpperCase().replace(/[\s-]+/g, '');
  if (generatedActivationKeyPattern.test(compact)) {
    return `SL-${compact.slice(2)}`;
  }
  return trimmed;
}

export function formatActivationKeyForDisplay(value: string | null | undefined) {
  const normalized = normalizeActivationKey(value);
  if (!canonicalActivationKeyPattern.test(normalized)) {
    return normalized;
  }
  return `SL-${chunk(normalized.slice(3), 4).join('-')}`;
}
