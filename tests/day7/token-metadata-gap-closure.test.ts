import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("Bread v1.6.1 sanitized token display metadata", () => {
  it("projects only plain display metadata, normalized external HTTPS URLs, and trusted Bread media references", async () => {
    const moduleUrl = new URL(
      "../../apps/api/src/display-metadata.ts",
      import.meta.url,
    );
    expect(existsSync(moduleUrl)).toBe(true);
    if (!existsSync(moduleUrl)) return;

    const { sanitizeIndexedDisplayMetadata } =
      await import("../../apps/api/src/display-metadata");
    const trustedBase = "https://media.bread.example/assets/";
    const raw = {
      image:
        "https://media.bread.example/assets/token-images/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/detail.webp",
      description: "<b>Hello</b>\n<script>alert(1)</script> Bread",
      website: "https://example.com/path",
      x: "https://x.com/bread",
      telegram: "https://t.me/bread",
      html: "<img src=x onerror=alert(1)>",
      arbitrary: "ignored",
    };

    expect(sanitizeIndexedDisplayMetadata(raw, trustedBase)).toEqual({
      image: raw.image,
      description: "Hello\nalert(1) Bread",
      website: "https://example.com/path",
      x: "https://x.com/bread",
      telegram: "https://t.me/bread",
    });

    expect(
      sanitizeIndexedDisplayMetadata(
        {
          image:
            "https://attacker.example/token-images/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/detail.webp",
          website: "javascript:alert(1)",
          x: "http://x.com/insecure",
          telegram: "https://user:pass@t.me/private",
        },
        trustedBase,
      ),
    ).toEqual({});
  });

  it("normalizes the existing launch metadata shape without admitting extra social fields", async () => {
    const { sanitizeIndexedDisplayMetadata } =
      await import("../../apps/api/src/display-metadata");
    const trustedBase = "https://media.bread.example/assets/";
    expect(
      sanitizeIndexedDisplayMetadata(
        {
          logo: "https://media.bread.example/assets/token-images/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/card.webp",
          description: "Bread <b>token</b>",
          socials: {
            website: "https://bread.example",
            twitter: "https://x.com/bread",
            telegram: "https://t.me/bread",
            discord: "https://discord.example/bread",
            farcaster: "https://warpcast.com/bread",
          },
        },
        trustedBase,
      ),
    ).toEqual({
      image:
        "https://media.bread.example/assets/token-images/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/card.webp",
      description: "Bread token",
      website: "https://bread.example/",
      x: "https://x.com/bread",
      telegram: "https://t.me/bread",
    });
  });

  it("keeps sanitized display metadata separate from finance and renders only the typed token-read projection", () => {
    const types = read("../../packages/types/src/api.ts");
    const token = read("../../apps/api/src/routes/token.ts");
    const reducer = read("../../apps/indexer/src/reducers.ts");
    const identity = read("../../apps/web/components/token/token-identity.tsx");

    expect(types).toContain("export type IndexedDisplayMetadata = Readonly<{");
    expect(types).toContain("metadata: IndexedDisplayMetadata;");
    expect(token).toContain("sanitizeIndexedDisplayMetadata");
    expect(reducer).toContain("metadata as metadataTable");
    expect(reducer).toContain("metadataJson: snapshot.metadata");
    expect(identity).toContain("metadata.description");
    expect(identity).toContain("metadata.website");
    expect(identity).toContain("metadata.x");
    expect(identity).toContain("metadata.telegram");
    expect(`${token}\n${identity}`).not.toContain("dangerouslySetInnerHTML");
    expect(`${token}\n${reducer}`).not.toMatch(
      /metadata.*(?:balance|reserve|fee|graduation)/i,
    );
  });
});
