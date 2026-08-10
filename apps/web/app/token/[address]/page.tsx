import { TokenClient } from '../../../components/token/token-client';

export default async function TokenPage({
  params,
}: Readonly<{
  params: Promise<{ address: string }>;
}>) {
  const { address } = await params;
  return <TokenClient address={address} />;
}
