import { FAUCET_SIMULATED_CLAIM_MS, type FaucetToken } from '@/config/faucet_config';

export interface FaucetClaimResult {
  amount: string;
  symbol: string;
}

// Simulated claim. Replace the body with a real faucet request (API route or
// on-chain call) when a backend exists; the page only depends on this signature.
export async function requestFaucetClaim(
  token: FaucetToken,
  _recipient: string
): Promise<FaucetClaimResult> {
  await new Promise((resolve) => setTimeout(resolve, FAUCET_SIMULATED_CLAIM_MS));
  return { amount: token.amount, symbol: token.symbol };
}
