// Wormhole NTT provider (Executor-relayed). Loaded only via dynamic import from
// lib/bridge/router.ts. See docs/dev_notes/plans/2 - NTT Bridge Integration Plan.md.

import {
  TransferState,
  Wormhole,
  amount as whAmount,
  deserialize,
  encoding,
  isNative,
  type Chain,
  type SignAndSendSigner,
} from '@wormhole-foundation/sdk-connect';
import * as routes from '@wormhole-foundation/sdk-connect/routes';
import type { NttExecutorRoute } from '@wormhole-foundation/sdk-route-ntt';
import type { Ntt } from '@wormhole-foundation/sdk-definitions-ntt';
import { NTT_BRIDGE_INFO, type NttChainDeployment } from '@/config/blockchain_config';
import {
  buildExplorerTxUrl,
  getActiveChain,
  type ActiveChainKey,
} from '@/config/active_chains';
import {
  NTT_REFERRER_FEE_BPS,
  NTT_TRACK_POLL_INTERVAL_MS,
  NTT_TRACK_TIMEOUT_MS,
  NTT_VAA_FETCH_TIMEOUT_MS,
  WORMHOLESCAN_TX_URL,
} from '@/config/ntt_config';
import {
  NTT_QUOTE_COPY,
  NTT_REDEEM_COPY,
  NTT_STATUS_COPY,
  QUOTE_ROW_LABELS,
  SWAP_PROGRESS_COPY,
} from '@/config/ui_config';
import { fromBaseUnits } from '@/lib/relay/quote';
import { findNttPair, type NttPair } from '@/lib/ntt/registry';
import { addPendingNtt, removePendingNtt, type PendingNttTransfer } from '@/lib/ntt/pending';
import { getNttRouteClass, getWormhole, toWormholeChain, type WhNetwork } from '@/lib/ntt/wormhole';
import { makeEvmWhSigner, makeSvmWhSigner, type OnTxSent } from '@/lib/ntt/signers';
import { TX_FAILED_ON_CHAIN } from '@/lib/relay/execute';
import {
  BridgeQuoteError,
  type BridgeLink,
  type BridgeProgress,
  type BridgeProvider,
  type BridgeQuote,
  type BridgeQuoteRow,
  type BridgeReceipt,
  type BridgeSigners,
} from '../types';

type RouteInstance = InstanceType<ReturnType<typeof getNttRouteClass>>;
type Request = routes.RouteTransferRequest<WhNetwork>;
type Quote = routes.Quote<
  NttExecutorRoute.Options,
  NttExecutorRoute.ValidatedParams,
  unknown
>;
type Receipt = NttExecutorRoute.TransferReceipt & {
  destinationTxs?: { txid: string }[];
  queueReleaseTime?: Date;
};

type NttRaw = {
  network: WhNetwork;
  pair: NttPair;
  whRoute: RouteInstance;
  request: Request;
  quote: Quote;
};

type NttReceiptData = {
  network: WhNetwork;
  whRoute: RouteInstance;
  receipt: Receipt;
  txid: string;
  fromChain: ActiveChainKey;
  toChain: ActiveChainKey;
  startedAt: number;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
};

const contractsFor = (entry: NttChainDeployment): Ntt.Contracts => ({
  token: entry.tokenContractAddress,
  manager: entry.NTTcontractAddress,
  transceiver: { wormhole: entry.NTTtransceiverAddress },
});

// Recipient on the destination chain. Same-VM routes default to the sender.
const resolveRecipient = (
  fromChain: ActiveChainKey,
  toChain: ActiveChainKey,
  user: string,
  recipient?: string
): string | undefined => {
  if (recipient) return recipient;
  return getActiveChain(fromChain).vmType === getActiveChain(toChain).vmType ? user : undefined;
};

const makeSigner = (
  chainKey: ActiveChainKey,
  whChain: Chain,
  signers: BridgeSigners,
  addressOverride?: string,
  onSent?: OnTxSent
): SignAndSendSigner<WhNetwork, Chain> => {
  const chain = getActiveChain(chainKey);
  if (chain.vmType === 'evm') {
    const address = addressOverride ?? signers.evmAddress;
    if (!signers.evm || !address) throw new Error(NTT_QUOTE_COPY.walletRequired('evm'));
    return makeEvmWhSigner(whChain, address, chain.relayChainId, signers.evm, onSent);
  }
  const address = addressOverride ?? signers.svmAddress;
  if (!signers.svm || !address) throw new Error(NTT_QUOTE_COPY.walletRequired('svm'));
  return makeSvmWhSigner(whChain, address, signers.svm, onSent);
};

// Setup txs that don't move tokens; the transfer is the last other tx sent.
const isSetupTx = (description: string): boolean => /approve|lut/i.test(description);

type Attestation = {
  emitterChain: Chain;
  payload: { nttManagerPayload: { payload: { recipientChain: Chain } } };
};
const attestationOf = (r: Receipt): Attestation | undefined =>
  (r as { attestation?: { attestation?: Attestation } }).attestation?.attestation;

// Rebuilds receipt data for a known source tx from config alone; track()
// then fetches the VAA and the current state from chain.
const buildDataFromTx = (p: PendingNttTransfer): NttReceiptData => {
  const deployment = NTT_BRIDGE_INFO[p.symbol];
  const srcKey = getActiveChain(p.fromChain).chainKey;
  const dstKey = getActiveChain(p.toChain).chainKey;
  const srcEntry = deployment?.chains[srcKey];
  const dstEntry = deployment?.chains[dstKey];
  if (!deployment || !srcEntry || !dstEntry) throw new Error(NTT_QUOTE_COPY.notNttRoute);

  const wh = getWormhole(p.network);
  const whRoute = new (getNttRouteClass(p.network))(wh);
  const from = toWormholeChain(srcKey);
  const to = toWormholeChain(dstKey);
  const receipt = {
    from,
    to,
    state: TransferState.SourceInitiated,
    originTxs: [{ chain: from, txid: p.txid }],
    params: {
      amount: '0',
      options: {},
      normalizedParams: {
        amount: whAmount.fromBaseUnits(0n, 0),
        sourceContracts: contractsFor(srcEntry),
        destinationContracts: contractsFor(dstEntry),
        transferTokenFee: 0n,
        nativeTokenFee: 0n,
      },
    },
  } as unknown as Receipt;

  return {
    network: p.network,
    whRoute,
    receipt,
    txid: p.txid,
    fromChain: p.fromChain,
    toChain: p.toChain,
    startedAt: p.startedAt,
  };
};

// One route.track() pass. Errors are swallowed: route.track() throws when the
// VAA isn't signed yet or the Executor status API is unreachable, but any
// state it yielded before throwing is kept.
const trackPass = async (d: NttReceiptData) => {
  try {
    for await (const r of d.whRoute.track(d.receipt, NTT_VAA_FETCH_TIMEOUT_MS)) {
      d.receipt = r as Receipt;
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
  }
};

// Reads redemption state straight from the destination NttManager, so
// tracking never depends on the Executor's status API.
const refreshDestinationState = async (d: NttReceiptData) => {
  const vaa = attestationOf(d.receipt);
  if (!vaa || d.receipt.state === TransferState.DestinationFinalized) return;
  try {
    const toChain = getWormhole(d.network).getChain(d.receipt.to as Chain);
    const ntt = await toChain.getProtocol('Ntt', {
      ntt: d.receipt.params.normalizedParams.destinationContracts,
    });
    const att = vaa as unknown as Parameters<typeof ntt.getIsExecuted>[0];
    if (await ntt.getIsExecuted(att)) {
      d.receipt = { ...d.receipt, state: TransferState.DestinationFinalized } as Receipt;
      return;
    }
    const queued = await ntt.getInboundQueuedTransfer(
      vaa.emitterChain,
      (att as unknown as { payload: { nttManagerPayload: Parameters<typeof ntt.getInboundQueuedTransfer>[1] } })
        .payload.nttManagerPayload
    );
    if (queued) {
      d.receipt = {
        ...d.receipt,
        state: TransferState.DestinationQueued,
        queueReleaseTime: new Date(queued.rateLimitExpiryTimestamp * 1000),
      } as Receipt;
    } else if (await ntt.getIsApproved(att)) {
      d.receipt = { ...d.receipt, state: TransferState.DestinationInitiated } as Receipt;
    }
  } catch {
    // RPC hiccup — the next pass retries.
  }
};

const isFailedOnChain = (err: unknown): boolean => (err as Error)?.name === TX_FAILED_ON_CHAIN;

const fmtUnits = (units: bigint, decimals: number): string => fromBaseUnits(units, decimals);

const buildLinks = (d: NttReceiptData): BridgeLink[] => {
  const links: BridgeLink[] = [
    { label: SWAP_PROGRESS_COPY.wormholescan, href: WORMHOLESCAN_TX_URL(d.txid, d.network) },
    { label: SWAP_PROGRESS_COPY.originTx, href: buildExplorerTxUrl(d.fromChain, d.txid) },
  ];
  const destTx = d.receipt.destinationTxs?.at(-1)?.txid;
  if (destTx) {
    links.push({ label: SWAP_PROGRESS_COPY.destinationTx, href: buildExplorerTxUrl(d.toChain, destTx) });
  }
  return links;
};

const toProgress = (d: NttReceiptData, opts: { stalled?: boolean } = {}): BridgeProgress => {
  const links = buildLinks(d);
  const note = NTT_STATUS_COPY.closeNote;
  const r = d.receipt;
  switch (r.state) {
    case TransferState.DestinationFinalized:
      return { kind: 'success', copy: NTT_STATUS_COPY.success, links };
    case TransferState.Refunded:
      return { kind: 'refunded', copy: NTT_STATUS_COPY.failure, links };
    case TransferState.Failed:
      // Relay failure isn't terminal: the VAA can still be redeemed by hand.
      return {
        kind: 'tracking',
        stage: 1,
        copy: NTT_STATUS_COPY.relayFailed,
        links,
        note,
        canRedeem: Boolean((r as { attestation?: unknown }).attestation),
      };
    case TransferState.DestinationQueued: {
      const release = r.queueReleaseTime;
      return {
        kind: 'tracking',
        stage: 2,
        copy: NTT_STATUS_COPY.destinationQueued,
        links,
        note: release ? NTT_STATUS_COPY.queueRelease(release.toLocaleString()) : note,
        canRedeem: release ? Date.now() >= release.getTime() : false,
      };
    }
    case TransferState.DestinationInitiated:
      return { kind: 'tracking', stage: 2, copy: NTT_STATUS_COPY.destinationInitiated, links, note };
    case TransferState.Attested:
      // Every NTT transfer is redeemed by the user once Guardians have signed.
      return {
        kind: 'tracking',
        stage: 1,
        copy: NTT_STATUS_COPY.attested,
        links,
        note: NTT_STATUS_COPY.redeemNote,
        canRedeem: true,
      };
    default:
      return {
        kind: 'tracking',
        stage: 0,
        copy: opts.stalled ? NTT_STATUS_COPY.stalled : NTT_STATUS_COPY.sourceInitiated,
        links,
        note,
      };
  }
};

export type NttTransferStatus = 'pending' | 'redeemable' | 'queued' | 'redeemed' | 'unknown';

// Redemption status of a past transfer, read from the destination NttManager
// using the VAA Wormholescan already returned (no extra VAA fetch).
export const getNttTransferStatus = async (item: {
  symbol: string;
  network: WhNetwork;
  toChain: ActiveChainKey;
  vaa?: string;
}): Promise<NttTransferStatus> => {
  if (!item.vaa) return 'pending';
  const dstKey = getActiveChain(item.toChain).chainKey;
  const dstEntry = NTT_BRIDGE_INFO[item.symbol]?.chains[dstKey];
  if (!dstEntry) return 'unknown';
  try {
    const vaa = deserialize('Ntt:WormholeTransfer', encoding.b64.decode(item.vaa));
    const chain = getWormhole(item.network).getChain(toWormholeChain(dstKey));
    const ntt = await chain.getProtocol('Ntt', { ntt: contractsFor(dstEntry) });
    const att = vaa as unknown as Parameters<typeof ntt.getIsExecuted>[0];
    if (await ntt.getIsExecuted(att)) return 'redeemed';
    const queued = await ntt.getInboundQueuedTransfer(vaa.emitterChain, vaa.payload.nttManagerPayload);
    if (queued) return Date.now() >= queued.rateLimitExpiryTimestamp * 1000 ? 'redeemable' : 'queued';
    return 'redeemable';
  } catch {
    return 'unknown';
  }
};

export const nttProvider: BridgeProvider = {
  id: 'ntt',

  async quote(route, signal): Promise<BridgeQuote> {
    const pair = findNttPair(route.fromChain, route.fromToken.address, route.toChain, route.toToken.address);
    if (!pair) throw new Error(NTT_QUOTE_COPY.notNttRoute);
    const network = pair.deployment.network;
    const wh = getWormhole(network);
    const RouteClass = getNttRouteClass(network);
    const whRoute = new RouteClass(wh);
    const srcChain = toWormholeChain(pair.src.chainKey);
    const dstChain = toWormholeChain(pair.dst.chainKey);
    const recipient = resolveRecipient(route.fromChain, route.toChain, route.user, route.recipient);

    const request = await routes.RouteTransferRequest.create(wh, {
      source: Wormhole.tokenId(srcChain, pair.src.entry.tokenContractAddress),
      destination: Wormhole.tokenId(dstChain, pair.dst.entry.tokenContractAddress),
      sender: Wormhole.chainAddress(srcChain, route.user),
      recipient: recipient ? Wormhole.chainAddress(dstChain, recipient) : undefined,
    });
    throwIfAborted(signal);

    const validation = await whRoute.validate(request, {
      amount: route.amount,
      options: whRoute.getDefaultOptions(),
    });
    if (!validation.valid) throw validation.error;
    const params = validation.params as NttExecutorRoute.ValidatedParams;
    throwIfAborted(signal);

    const quote = (await whRoute.quote(request, params)) as routes.QuoteResult<
      NttExecutorRoute.Options,
      NttExecutorRoute.ValidatedParams
    >;
    if (!quote.success) throw quote.error;
    throwIfAborted(signal);

    // Rate limits: the route only warns on the destination side, so check both
    // capacities ourselves and refuse amounts that would revert or be queued.
    const srcDecimals = request.source.decimals;
    const sendUnits = whAmount.units(params.normalizedParams.amount);
    const recvUnits = whAmount.units(quote.destinationToken.amount);
    const [srcNtt, dstNtt] = await Promise.all([
      request.fromChain.getProtocol('Ntt', { ntt: params.normalizedParams.sourceContracts }),
      request.toChain.getProtocol('Ntt', { ntt: params.normalizedParams.destinationContracts }),
    ]);
    const [srcDuration, dstDuration] = await Promise.all([
      srcNtt.getRateLimitDuration(),
      dstNtt.getRateLimitDuration(),
    ]);
    if (srcDuration > 0n) {
      const outbound = await srcNtt.getCurrentOutboundCapacity();
      if (sendUnits > outbound) {
        throw new BridgeQuoteError(
          NTT_QUOTE_COPY.capacityError(fmtUnits(outbound, srcDecimals), pair.symbol),
          'capacity'
        );
      }
    }
    if (dstDuration > 0n) {
      const inbound = await dstNtt.getCurrentInboundCapacity(srcChain);
      if (recvUnits > inbound) {
        throw new BridgeQuoteError(
          NTT_QUOTE_COPY.capacityError(fmtUnits(inbound, request.destination.decimals), pair.symbol),
          'capacity'
        );
      }
    }
    throwIfAborted(signal);

    const fromMeta = getActiveChain(route.fromChain);
    const relayFee = quote.relayFee;
    const relayFeeNative = relayFee ? isNative(relayFee.token.address) : false;
    const details = quote.details as { transferTokenFee?: bigint } | undefined;
    const ourFeeUnits = details?.transferTokenFee ?? params.normalizedParams.transferTokenFee;
    const pct = NTT_REFERRER_FEE_BPS / 100;

    const rows: Array<BridgeQuoteRow | undefined> = [
      relayFee
        ? {
            label: QUOTE_ROW_LABELS.relayFee,
            value: `${whAmount.display(relayFee.amount)} ${relayFeeNative ? fromMeta.nativeSymbol : pair.symbol}`,
          }
        : undefined,
      {
        label: QUOTE_ROW_LABELS.bridgeFee,
        value: `${fmtUnits(ourFeeUnits, srcDecimals)} ${pair.symbol} (${pct}%)`,
      },
      { label: QUOTE_ROW_LABELS.delivery, value: NTT_QUOTE_COPY.delivery },
    ];

    const raw: NttRaw = { network, pair, whRoute, request, quote: quote as Quote };
    return {
      provider: 'ntt',
      route,
      outputAmountFormatted: whAmount.display(quote.destinationToken.amount),
      timeEstimateSeconds: quote.eta ? Math.round(quote.eta / 1000) : undefined,
      feeLabel: `${pct}% fee`,
      rows: rows.filter((r): r is BridgeQuoteRow => Boolean(r)),
      warning: quote.warnings?.length ? NTT_QUOTE_COPY.capacityWarning : undefined,
      requiredNativeRaw: relayFee && relayFeeNative ? whAmount.units(relayFee.amount) : undefined,
      raw,
    };
  },

  async execute(quote, signers, onProgress): Promise<BridgeReceipt> {
    const { network, pair, whRoute, request, quote: q } = quote.raw as NttRaw;
    const { route } = quote;
    if (q.expires && q.expires.getTime() <= Date.now()) throw new Error(NTT_QUOTE_COPY.quoteExpired);

    const recipient = resolveRecipient(route.fromChain, route.toChain, route.user, route.recipient);
    if (!recipient) throw new Error(NTT_QUOTE_COPY.recipientRequired);

    const srcChain = toWormholeChain(pair.src.chainKey);
    const dstChain = toWormholeChain(pair.dst.chainKey);
    const startedAt = Date.now();
    const record = (txid: string): PendingNttTransfer => ({
      symbol: pair.symbol,
      network,
      fromChain: route.fromChain,
      toChain: route.toChain,
      txid,
      startedAt,
    });

    // Record the transfer tx the moment it is broadcast. If anything after
    // that throws, the tokens have still left the wallet, and this record is
    // what lets tracking (and redeem) continue.
    let sentTxid: string | undefined;
    const onSent: OnTxSent = (txid, description) => {
      if (isSetupTx(description)) return;
      sentTxid = txid;
      addPendingNtt(record(txid));
    };
    const signer = makeSigner(route.fromChain, srcChain, signers, route.user, onSent);

    onProgress({ kind: 'executing', label: SWAP_PROGRESS_COPY.confirmInWallet });
    let receipt: Receipt | undefined;
    try {
      receipt = (await whRoute.initiate(
        request,
        signer,
        q as Parameters<RouteInstance['initiate']>[2],
        Wormhole.chainAddress(dstChain, recipient)
      )) as Receipt;
    } catch (err) {
      if (!sentTxid) throw err; // nothing left the wallet
      if (isFailedOnChain(err)) {
        removePendingNtt(sentTxid);
        throw err;
      }
      // Broadcast but the SDK/wallet errored afterwards — keep tracking.
    }

    const txid =
      (receipt as { originTxs?: { txid: string }[] } | undefined)?.originTxs?.at(-1)?.txid ?? sentTxid;
    if (!txid) throw new Error(SWAP_PROGRESS_COPY.unknownError);
    if (txid !== sentTxid) addPendingNtt(record(txid));

    const data: NttReceiptData = receipt
      ? { network, whRoute, receipt, txid, fromChain: route.fromChain, toChain: route.toChain, startedAt }
      : buildDataFromTx(record(txid));
    onProgress(toProgress(data));
    return { provider: 'ntt', data };
  },

  // route.track() is a single pass (fetch VAA → check relay → check
  // redemption), so loop it until delivery, failure, or timeout.
  async track(receipt, onProgress, signal): Promise<BridgeProgress> {
    const d = receipt.data as NttReceiptData;
    const deadline = Date.now() + NTT_TRACK_TIMEOUT_MS;
    while (Date.now() < deadline) {
      throwIfAborted(signal);
      if (d.receipt.state !== TransferState.DestinationFinalized) await trackPass(d);
      await refreshDestinationState(d);
      if (d.receipt.state === TransferState.DestinationFinalized) {
        removePendingNtt(d.txid);
        const done = toProgress(d);
        onProgress(done);
        return done;
      }
      onProgress(toProgress(d));
      await sleep(NTT_TRACK_POLL_INTERVAL_MS);
    }
    // No VAA after the full window: the source tx never produced a message
    // (e.g. it failed), so stop resuming it on every visit.
    if (d.receipt.state === TransferState.SourceInitiated) removePendingNtt(d.txid);
    return toProgress(d, { stalled: true });
  },

  // Redeems the VAA on the destination chain (or finalizes a rate-limit-queued
  // transfer). The track() loop picks up the resulting state.
  async redeem(receipt, signers, onProgress): Promise<void> {
    const d = receipt.data as NttReceiptData;
    const dstChain = d.receipt.to as Chain;
    const signer = makeSigner(d.toChain, dstChain, signers);
    // The Executor may have delivered it in the meantime; don't send a tx that would revert.
    await refreshDestinationState(d);
    if (d.receipt.state === TransferState.DestinationFinalized) {
      onProgress(toProgress(d));
      return;
    }
    onProgress({ kind: 'executing', label: SWAP_PROGRESS_COPY.confirmInWallet });
    const next =
      d.receipt.state === TransferState.DestinationQueued
        ? await d.whRoute.finalize(signer, d.receipt as Parameters<RouteInstance['finalize']>[1])
        : await d.whRoute.complete(signer, d.receipt as Parameters<RouteInstance['complete']>[1]);
    d.receipt = next as Receipt;
    onProgress(toProgress(d));
  },

  async resume(record): Promise<BridgeReceipt> {
    return { provider: 'ntt', data: buildDataFromTx(record as PendingNttTransfer) };
  },

  // Destination-side redeem for a transfer identified only by its source tx
  // hash (e.g. one whose automatic delivery never happened). Looks up the
  // Guardian-signed VAA, checks it targets this route, and redeems it with the
  // connected destination wallet. Resolves with a receipt for track().
  async redeemByTx(record, signers, onProgress): Promise<BridgeReceipt> {
    const p = record as PendingNttTransfer;
    const d = buildDataFromTx(p);
    const receipt: BridgeReceipt = { provider: 'ntt', data: d };

    onProgress({ kind: 'executing', label: NTT_REDEEM_COPY.lookingUp });
    await trackPass(d);
    await refreshDestinationState(d);

    const vaa = attestationOf(d.receipt);
    if (!vaa) throw new Error(NTT_REDEEM_COPY.notSignedYet);
    if (vaa.payload.nttManagerPayload.payload.recipientChain !== d.receipt.to) {
      throw new Error(NTT_REDEEM_COPY.wrongRoute);
    }

    addPendingNtt(p); // so a reload keeps tracking it
    if (d.receipt.state === TransferState.DestinationFinalized) return receipt; // already delivered
    await nttProvider.redeem!(receipt, signers, onProgress);
    return receipt;
  },
};
