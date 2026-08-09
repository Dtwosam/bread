export type ReconciliationCheckId = 'REC-01' | 'REC-02' | 'REC-03' | 'REC-04' | 'REC-05' | 'REC-06';

export type ReconciliationCheck = Readonly<{
  id: ReconciliationCheckId;
  status: 'PASS' | 'FAIL';
  expected: string;
  actual: string;
  detail: string;
}>;

export type ReconciliationReport = Readonly<{
  reportVersion: string;
  status: 'PASS' | 'FAIL';
  chainId: number;
  stackVersion: string;
  factoryAddress: string;
  manifestHash: string | null;
  sourceHash: string | null;
  deploymentStartBlock: string;
  checkedBlock: string;
  checkedBlockHash: string;
  canonicalEventCount: number;
  startedAt: string;
  completedAt: string;
  checks: readonly ReconciliationCheck[];
}>;