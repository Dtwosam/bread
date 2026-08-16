export default function RisksPage() {
  return (
    <main className="bread-page bread-readable-route bread-readable-route--legal">
      <article className="bread-readable-route__content">
        <header>
          <p className="bread-eyebrow">Legal</p>
          <h1>Risks</h1>
        </header>
        <section className="bread-state bread-state--warning" aria-labelledby="bread-risks-copy-heading">
          <h2 id="bread-risks-copy-heading">Approved risk disclosure required</h2>
          <p>
            Bread&apos;s UI specification requires a plain-language financial risk disclosure here, but
            the controlling project sources do not contain approved legal copy for that disclosure.
            The interface leaves that legal dependency explicit rather than publishing invented risk
            language as an approved policy.
          </p>
        </section>
      </article>
    </main>
  );
}
