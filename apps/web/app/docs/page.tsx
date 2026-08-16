export default function DocsPage() {
  return (
    <main className="bread-page bread-readable-route">
      <aside className="bread-readable-route__nav" aria-label="Documentation sections">
        <a href="#product">Product</a>
        <a href="#network">Network</a>
        <a href="#transactions">Transactions</a>
      </aside>

      <article className="bread-readable-route__content">
        <header>
          <p className="bread-eyebrow">Docs</p>
          <h1>Bread documentation</h1>
          <p>
            Bread is an Arc launchpad for discovering, understanding, trading, creating and managing
            tokens with USDC as the quote asset.
          </p>
        </header>

        <section id="product">
          <h2>Product surfaces</h2>
          <p>
            Explore is the discovery surface. Token pages keep market state, graduation state and
            Buy/Sell close together. Create uses a staged Token, Economics and Review flow. Portfolio
            and Creator surfaces cover wallet holdings, launches, revenue and claims.
          </p>
        </section>

        <section id="network">
          <h2>Network and quote asset</h2>
          <p>
            Transaction actions target Arc and use canonical USDC configuration from the active Bread
            deployment. Browsing remains available while a wallet is disconnected or on another chain.
          </p>
          <pre className="bread-technical"><code>Network: Arc{`\n`}Quote asset: USDC</code></pre>
        </section>

        <section id="transactions">
          <h2>Transaction truthfulness</h2>
          <p>
            Bread shows prepared transaction consequences before wallet confirmation and preserves
            submitted transaction identity through confirmation and recovery. A frontend or indexed
            read-service outage does not rewrite onchain contract state.
          </p>
        </section>
      </article>
    </main>
  );
}
