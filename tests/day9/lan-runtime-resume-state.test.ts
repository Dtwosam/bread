import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("Day 9 LAN acceptance persisted catch-up state", () => {
  it("preserves the committed Postgres checkpoint on ordinary teardown and requires an explicit destructive reset", () => {
    const orchestrator = readFileSync(
      resolve(root, "scripts/day9/lan/run-lan-acceptance.mjs"),
      "utf8",
    );

    expect(orchestrator).toContain("BREAD_LAN_RESET_STATE");
    expect(orchestrator).toContain(
      "reset requested: removing prior LAN acceptance state",
    );
    expect(orchestrator).toContain("['compose', '-f', compose, 'down', '-v']");

    const teardown = orchestrator.match(
      /async function teardown\(\) \{([\s\S]*?)\n\}/,
    );
    expect(teardown?.[1]).toContain("['compose', '-f', compose, 'down']");
    expect(teardown?.[1]).not.toContain("'-v'");
  });
});
