import { NextRequest, NextResponse } from 'next/server';
import { getPublicKeyPem } from '@/lib/byok/serverKeys';
import { enforceRateLimit } from '@/lib/rate-limit';

// The client fetches this to encrypt the user's API key before sending it. The
// keypair may be ephemeral (per process), so never cache this response.
export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, { bucket: 'pubkey', limit: 60, windowSec: 60 });
  if (limited) return limited;

  return NextResponse.json(
    { publicKey: getPublicKeyPem() },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
