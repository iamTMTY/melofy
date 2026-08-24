import { NextResponse } from 'next/server';
import { getPublicKeyPem } from '@/lib/byok/serverKeys';

// The client fetches this to encrypt the user's API key before sending it. The
// keypair may be ephemeral (per process), so never cache this response.
export async function GET() {
  return NextResponse.json(
    { publicKey: getPublicKeyPem() },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
