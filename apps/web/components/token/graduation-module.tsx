import arcTestnetManifest from '../../../../config/networks/arc-testnet.json';
import type { IndexedTokenDetail } from '../../../../packages/types/src/index';
import { formatUsdcBaseUnits } from '../explore/model';

type Address = `0x${string}`;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

function progressPercent(progressBps: string | null | undefined): number | null {
  if (!progressBps || !/^\d+$/.test(progressBps)) return null;
  const bps = Number(progressBps);
  if (!Number.isFinite(bps) || bps < 0 || bps > 10_000) return null;
  return bps / 100;
}

function remainingQuote(
  realQuoteReserve: string | null | undefined,
  graduationThreshold: string | null | undefined,
): string | null {
  if (!realQuoteReserve || !graduationThreshold) return null;
  if (!/^\d+$/.test(realQuoteReserve) || !/^\d+$/.test(graduationThreshold)) return null;
  const reserve = BigInt(realQuoteReserve);
  const target = BigInt(graduationThreshold);
  return (target > reserve ? target - reserve : BigInt(0)).toString(10);
}

function graduatedVenueLabel(kind: string | null | undefined): string {
  if (kind === 'UNISWAP_V3') return 'Uniswap V3';
  return kind ?? '—';
}

function displayState(token: IndexedTokenDetail): 'Active' | 'Graduating' | 'Graduation pending' | 'Graduated' {
  if (token.curveState?.positionLocked === true) return 'Graduated';
  if (token.curveState?.graduationFailureReasonHash) return 'Graduation pending';
  const graduationPhase = token.curveState?.graduationPhase;
  if (
    token.curveState?.readyToGraduate ||
    (graduationPhase !== null && graduationPhase !== undefined && graduationPhase !== 'NOT_GRADUATED')
  ) {
    return 'Graduating';
  }
  return 'Active';
}

function automaticGraduationCopy(token: IndexedTokenDetail): string | null {
  if (token.curveState?.positionLocked === true) return null;
  if (token.curveState?.graduationFailureReasonHash) {
    return 'Your completed trade remains confirmed. Bread’s automatic graduation keeper will retry from fresh canonical onchain coordinator state. No creator or user wallet signature is required.';
  }
  if (displayState(token) === 'Graduating') {
    return 'The bonding curve is complete. Liquidity creation is in progress. Completed trades remain confirmed. Bread’s automatic graduation keeper advances the next permissionless coordinator step. No creator action or wallet signature is required.';
  }
  return null;
}

export function GraduationModule({ token }: Readonly<{ token: IndexedTokenDetail }>) {
  const progressBps = token.progress?.progressBps ?? null;
  const percent = progressPercent(progressBps);
  const state = displayState(token);
  const graduationPhase = token.curveState?.graduationPhase ?? null;
  const poolId = token.curveState?.poolId ?? null;
  const positionLocked = token.curveState?.positionLocked ?? null;
  const positionManager = token.curveState?.positionManager ?? null;
  const positionManagerAddress = positionManager && ADDRESS.test(positionManager)
    ? positionManager as Address
    : null;
  const positionManagerHref = positionManagerAddress
    ? `${arcTestnetManifest.explorer}/address/${positionManagerAddress}`
    : null;
  const accumulatedQuote = token.curveState?.realQuoteReserve ?? null;
  const remainingQuoteAmount = remainingQuote(accumulatedQuote, token.graduationThreshold);
  const automaticCopy = automaticGraduationCopy(token);

  return (
    <section className="bread-graduation" aria-labelledby="bread-graduation-heading">
      <div className="bread-token-section-heading">
        <div>
          <h2 id="bread-graduation-heading">Graduation</h2>
          <p>
            {state} · Indexed state {token.progress?.state ?? graduationPhase ?? '—'}
          </p>
        </div>
        <strong>
          {state === 'Graduated'
            ? graduatedVenueLabel(token.graduatedVenueKind)
            : state === 'Active' && percent !== null
              ? `${percent.toFixed(1)}% baked`
              : progressBps === null
                ? '—'
                : `${progressBps} bps`}
        </strong>
      </div>

      <div className="bread-progress-track" aria-hidden="true">
        <span className="bread-progress-value" style={{ width: percent === null ? '0%' : `${percent}%` }} />
      </div>

      <dl className="bread-graduation__facts">
        {state === 'Active' ? (
          <>
            <div>
              <dt>Accumulated</dt>
              <dd>{formatUsdcBaseUnits(accumulatedQuote)}</dd>
            </div>
            <div>
              <dt>Snapshotted target</dt>
              <dd>{formatUsdcBaseUnits(token.graduationThreshold)}</dd>
            </div>
            <div>
              <dt>Remaining</dt>
              <dd>{formatUsdcBaseUnits(remainingQuoteAmount)}</dd>
            </div>
          </>
        ) : state === 'Graduated' ? (
          <>
            <div>
              <dt>Venue</dt>
              <dd>{graduatedVenueLabel(token.graduatedVenueKind)}</dd>
            </div>
            <div>
              <dt>Liquidity USDC</dt>
              <dd>{formatUsdcBaseUnits(token.curveState?.usdcUsed ?? null)}</dd>
            </div>
            <div>
              <dt>Pool ID</dt>
              <dd>{poolId ?? '—'}</dd>
            </div>
            <div>
              <dt>Position manager</dt>
              <dd>
                {positionManagerHref && positionManagerAddress ? (
                  <a
                    href={positionManagerHref}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open position manager in Arcscan"
                  >
                    {positionManagerAddress}
                  </a>
                ) : positionManager ?? '—'}
              </dd>
            </div>
            <div>
              <dt>Adapter</dt>
              <dd>{token.curveState?.graduationAdapter ?? token.graduationAdapter ?? '—'}</dd>
            </div>
            <div>
              <dt>Permanent lock</dt>
              <dd>{positionLocked === true ? 'Indexed locked' : 'Not yet indexed locked'}</dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt>Tracked quote</dt>
              <dd>{formatUsdcBaseUnits(token.curveState?.trackedQuote ?? null)}</dd>
            </div>
            <div>
              <dt>Snapshotted target</dt>
              <dd>{formatUsdcBaseUnits(token.graduationThreshold)}</dd>
            </div>
            <div>
              <dt>Phase</dt>
              <dd>{graduationPhase ?? '—'}</dd>
            </div>
            <div>
              <dt>Adapter</dt>
              <dd>{token.curveState?.graduationAdapter ?? token.graduationAdapter ?? '—'}</dd>
            </div>
            <div>
              <dt>Pool</dt>
              <dd>{poolId ?? '—'}</dd>
            </div>
            <div>
              <dt>Permanent-lock evidence</dt>
              <dd>{positionLocked === null ? '—' : positionLocked ? 'Indexed locked' : 'Not yet indexed locked'}</dd>
            </div>
          </>
        )}
      </dl>

      {automaticCopy ? (
        <div className="bread-graduation__recovery" role="status">
          <p className="bread-token-note">{automaticCopy}</p>
        </div>
      ) : null}

      <p className="bread-token-note">
        {state === 'Graduated'
          ? 'Venue, pool and permanent-lock status reflect indexed protocol evidence. Permanent lock is not a safety guarantee or protocol security assessment.'
          : 'Graduation and lock labels reflect indexed protocol events. Bread’s automatic keeper re-reads authoritative onchain coordinator state before every retry. Status labels are evidence, not a protocol security assessment.'}
      </p>
    </section>
  );
}
