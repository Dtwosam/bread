import { redirect } from 'next/navigation';

const EXACT_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export default async function ProfileCompatibilityPage({
  params,
}: Readonly<{
  params: Promise<{ address: string }>;
}>) {
  const { address } = await params;
  if (EXACT_ADDRESS.test(address)) {
    redirect(`/explore?creator=${encodeURIComponent(address.toLowerCase())}`);
  }
  redirect('/explore');
}
