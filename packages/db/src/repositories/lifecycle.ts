import { sql, type SQL } from 'drizzle-orm';

export type IndexedLifecycleState =
  | 'GRADUATED'
  | 'GRADUATION_PENDING'
  | 'PROCESSING'
  | 'ALMOST_BAKED'
  | 'NEW'
  | 'ACTIVE';

export type IndexedLifecycleInput = Readonly<{
  graduationPhase: string | null | undefined;
  readyToGraduate: boolean | null | undefined;
  graduationFailureReasonHash: string | null | undefined;
  mode: string | null | undefined;
  graduationProgressBps: bigint | string | null | undefined;
  launchTimestamp: bigint | string | null | undefined;
  initialSupply: bigint | string | null | undefined;
}>;

function isOrdinaryPreGraduationPhase(phase: string | null | undefined): boolean {
  return phase == null || phase === 'NOT_GRADUATED';
}

export function resolveIndexedLifecycleState(
  input: IndexedLifecycleInput,
): IndexedLifecycleState | null {
  if (input.graduationPhase === 'POOL_CREATED') return 'GRADUATED';
  if (
    input.graduationPhase === 'NOT_GRADUATED' &&
    input.readyToGraduate === true &&
    input.graduationFailureReasonHash != null
  ) {
    return 'GRADUATION_PENDING';
  }
  if (input.graduationPhase === 'SWEPT') return 'PROCESSING';
  if (!isOrdinaryPreGraduationPhase(input.graduationPhase)) return null;
  if (input.graduationProgressBps != null) return 'ALMOST_BAKED';
  if (input.launchTimestamp != null && input.initialSupply != null) return 'NEW';
  if (input.mode === 'ACTIVE') return 'ACTIVE';
  return null;
}

export type IndexedLifecycleSqlFields = Readonly<{
  graduationPhase: SQL;
  readyToGraduate: SQL;
  graduationFailureReasonHash: SQL;
  mode: SQL;
  graduationProgressBps: SQL;
  launchTimestamp: SQL;
  initialSupply: SQL;
}>;

export function indexedLifecycleStateSql(fields: IndexedLifecycleSqlFields): SQL {
  return sql`CASE
    WHEN ${fields.graduationPhase} = 'POOL_CREATED' THEN 'GRADUATED'
    WHEN ${fields.graduationPhase} = 'NOT_GRADUATED'
      AND ${fields.readyToGraduate} IS TRUE
      AND ${fields.graduationFailureReasonHash} IS NOT NULL
      THEN 'GRADUATION_PENDING'
    WHEN ${fields.graduationPhase} = 'SWEPT' THEN 'PROCESSING'
    WHEN COALESCE(${fields.graduationPhase}, 'NOT_GRADUATED') NOT IN ('NOT_GRADUATED') THEN NULL
    WHEN ${fields.graduationProgressBps} IS NOT NULL THEN 'ALMOST_BAKED'
    WHEN ${fields.launchTimestamp} IS NOT NULL
      AND ${fields.initialSupply} IS NOT NULL
      THEN 'NEW'
    WHEN ${fields.mode} = 'ACTIVE' THEN 'ACTIVE'
    ELSE NULL
  END`;
}
