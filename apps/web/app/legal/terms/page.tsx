export default function TermsPage() {
  return (
    <main className="bread-page bread-readable-route bread-readable-route--legal">
      <article className="bread-readable-route__content">
        <header>
          <p className="bread-eyebrow">Legal</p>
          <h1>Terms</h1>
        </header>
        <section className="bread-state" aria-labelledby="bread-terms-copy-heading">
          <h2 id="bread-terms-copy-heading">Approved legal copy required</h2>
          <p>
            The controlling Bread product and UI sources define this Terms route and its readable
            layout, but they do not supply approved legal copy. Bread does not invent contractual
            terms in the interface.
          </p>
        </section>
      </article>
    </main>
  );
}
