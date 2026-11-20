// Request / response shapes shared by the claim route and the page.

export interface FaucetClaimRequest {
  tokenId: string;
  recipient: string;
}

export type FaucetErrorCode =
  | 'bad_request'
  | 'invalid_token'
  | 'invalid_address'
  | 'cooldown'
  | 'not_configured'
  | 'dry'
  | 'send_failed'
  | 'network'; // client-side only: the route couldn't be reached

export interface FaucetClaimSuccess {
  ok: true;
  amount: string;
  symbol: string;
  txHash: string;
  explorerUrl: string;
}

export interface FaucetClaimFailure {
  ok: false;
  code: FaucetErrorCode;
  message: string;
  retryAfterSeconds?: number; // set when code is 'cooldown'
}

export type FaucetClaimResponse = FaucetClaimSuccess | FaucetClaimFailure;
