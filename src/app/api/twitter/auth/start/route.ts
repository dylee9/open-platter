import { twitterOAuth } from '@/lib/twitter-oauth';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    const callbackUrl = `${appBaseUrl}/api/twitter/auth/callback`;

    const { oauth_token, oauth_token_secret, oauth_callback_confirmed } = await twitterOAuth.getRequestToken(callbackUrl);

    if (!oauth_callback_confirmed) {
      return NextResponse.json({ error: 'OAuth callback not confirmed' }, { status: 400 });
    }

    // Store the secret in a cookie to verify on callback
    cookies().set('twitter_oauth_secret', oauth_token_secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 15, // 15 minutes
      path: '/',
    });

    const authUrl = twitterOAuth.getAuthorizationUrl(oauth_token);
    return NextResponse.json({ authUrl });

  } catch (error) {
    console.error('Error starting twitter auth:', error);
    return NextResponse.json({ error: 'Failed to start Twitter authentication' }, { status: 500 });
  }
} 