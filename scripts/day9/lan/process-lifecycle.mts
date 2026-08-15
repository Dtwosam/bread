import type { ChildProcess } from 'node:child_process';

/**
 * Deterministically terminate a spawned runtime process.
 *
 * SIGTERM first so the child can close listeners and database handles, then
 * SIGKILL if it refuses to exit inside the grace window. Resolves only once the
 * process has actually exited, so teardown cannot leave a LAN listener behind.
 */
export async function terminateProcess(child: ChildProcess, graceMs = 5_000): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;

  const exited = new Promise<void>((done) => {
    child.once('exit', () => done());
  });

  child.kill('SIGTERM');

  let killTimer: NodeJS.Timeout | undefined;
  const escalate = new Promise<void>((done) => {
    killTimer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      done();
    }, graceMs);
  });

  await Promise.race([exited, escalate.then(() => exited)]);
  if (killTimer) clearTimeout(killTimer);
}

export async function terminateAll(children: readonly ChildProcess[], graceMs = 5_000): Promise<void> {
  await Promise.all(children.map((child) => terminateProcess(child, graceMs)));
}
