export default async function TokenPage({
  params,
}: Readonly<{
  params: Promise<{ address: string }>;
}>) {
  const { address } = await params;

  return (
    <main className="bread-page" aria-labelledby="bread-token-route-heading">
      <h1 className="bread-page__heading" id="bread-token-route-heading">
        Token
      </h1>
      <code className="bread-technical">{address}</code>
    </main>
  );
}
