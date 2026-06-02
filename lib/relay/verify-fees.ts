// Manual fee-collection sanity check. Run after each environment promotion to
// confirm appFees ⇢ paidAppFees on completed swaps.
//
// Usage (from a Node script or one-off):
//   const report = await verifyAppFees('0x…recipient', 5);
//   console.table(report);
//
// Per Relay's App Fees doc: a request where `appFees` is present but
// `paidAppFees` is empty/zero means the fee was not collected for that swap.

import { RELAY_API_BASE, RELAY_REQUESTS_PATH } from '@/config/relay_config';

export type AppFeeVerificationRow = {
  requestId: string;
  status: string;
  appFeesQuoted: string;
  appFeesPaid: string;
  okay: boolean;
};

type RelayRequest = {
  id?: string;
  status?: string;
  appFees?: Array<{ recipient: string; amount: string }>;
  paidAppFees?: Array<{ recipient: string; amount: string }>;
};

export const verifyAppFees = async (
  recipient: string,
  limit = 10
): Promise<AppFeeVerificationRow[]> => {
  const url = `${RELAY_API_BASE}${RELAY_REQUESTS_PATH}?recipient=${encodeURIComponent(
    recipient
  )}&limit=${limit}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Relay /requests/v2 returned ${res.status}`);
  const body = (await res.json()) as { requests?: RelayRequest[] } | RelayRequest[];
  const requests = Array.isArray(body) ? body : (body.requests ?? []);

  return requests.map((r) => {
    const quoted = (r.appFees ?? []).reduce((acc, f) => acc + BigInt(f.amount || '0'), 0n);
    const paid = (r.paidAppFees ?? []).reduce((acc, f) => acc + BigInt(f.amount || '0'), 0n);
    return {
      requestId: r.id ?? '',
      status: r.status ?? '',
      appFeesQuoted: quoted.toString(),
      appFeesPaid: paid.toString(),
      okay: quoted === 0n ? true : paid > 0n,
    };
  });
};
