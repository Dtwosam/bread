import type { IndexedTokenDetail } from '../../../../packages/types/src/index';
import { formatUsdcBaseUnits } from '../explore/model';

function progressPercent(progressBps: string | null | undefined): number | null {
  if (!progressBps || !/^\d+$/.test(progressBps)) return null;
  const bps = Number(progressBps);
  if (!Number.isFinite(bps) || bps < 0 || bps > 10_000) return null;
  return bps / 100;
}

function displayState(token: IndexedTokenDetail): 'Active' | 'Processing' | 'Pending' | 'Graduated' {
  if (token.curveState?.positionLocked === true) return 'Graduated';
  if (token.curveState?.graduationFailureReasonHash) return 'Pending';
  const graduationPhase = token.curveState?.graduationPhase;
  if (
    token.curveState?.readyToGraduate ||
    (graduationPhase !== null && graduationPhase !== undefined && graduationPhase !== 'NOT_GRADUATED')
  ) {
    return 'Processing';
  }
  return 'Active';
}

export function GraduationModule({ token }: Readonly<{ token: IndexedTokenDetail }>) {
  const progressBps = token.progress?.progressBps ?? null;
  const percent = progressPercent(progressBps);
  const graduationPhase = token.curveState?.graduationPhase ?? null;
  const poolId = token.curveState?.poolId ?? null;
  const positionLocked = token.curveState?.positionLocked ?? null;

  return (
    <section className="bread-graduation" aria-labelledby="bread-graduation-heading">
      <div className="bread-token-section-heading">
        <div>
          <h2 id="bread-graduation-heading">Graduation</h2>
          <p>
            {displayState(token)} · Indexed state {token.progress?.state ?? graduationPhase ?? '—'}
          </p>
        </div>
        <strong>{progressBps === null ? '—' : `${progressBps} bps`}</strong>
      </div>

      <div className="bread-progress-track" aria-hidden="true">
        <span className="bread-progress-value" style={{ width: percent === null ? '0%' : `${percent}%` }} />
      </div>

      <dl className="bread-graduation__facts">
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
      </dl>
      <p className="bread-token-note">
        Graduation and lock labels reflect indexed protocol events. They are status evidence, not a protocol security assessment.
      </p>
    </section>
  );
}
