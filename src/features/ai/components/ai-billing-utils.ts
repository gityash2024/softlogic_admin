import { toast } from 'sonner';

import { extractApiError } from '@/lib/api';
import { aiBillingApi } from '@/services/ai-billing.api';
import type { AiOrderStatus } from '@/types/ai';

export function orderStatusVariant(status: AiOrderStatus) {
  if (status === 'FULFILLED' || status === 'PAID') return 'success' as const;
  if (status === 'FAILED' || status === 'CANCELLED' || status === 'EXPIRED') return 'danger' as const;
  if (status.includes('REFUND')) return 'purple' as const;
  return 'warning' as const;
}

export async function openReceipt(orderId: string) {
  // Open the window synchronously so popup blockers allow it, then fill it.
  const win = window.open('', '_blank');
  try {
    const html = await aiBillingApi.receipt(orderId);
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } else {
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      window.open(url, '_blank');
    }
  } catch (error) {
    win?.close();
    toast.error(extractApiError(error));
  }
}
