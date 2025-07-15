import { twitterOAuth } from '@/lib/twitter-oauth';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { user as userSchema } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;
  const searchParams = req.nextUrl.searchParams;
  const oauthToken = searchParams.get('oauth_token');
  const oauthVerifier = searchParams.get('oauth_verifier');
  
  const oauthTokenSecret = cookies().get('twitter_oauth_secret')?.value;

  if (!oauthToken || !oauthVerifier || !oauthTokenSecret) {
    return NextResponse.redirect(`${appBaseUrl}/?error=twitter_auth_failed&reason=missing_params`);
  }

  try {
    const { oauth_token, oauth_token_secret, user_id, screen_name } = await twitterOAuth.getAccessToken(
      oauthToken,
      oauthTokenSecret,
      oauthVerifier
    );

    const twitterUser = await twitterOAuth.getUserProfile(oauth_token, oauth_token_secret);

    // Save user credentials to database
    await db.insert(userSchema).values({
      id: 1, // Since it's a single-user app
      twitterUserId: user_id,
      twitterUsername: screen_name,
      twitterDisplayName: twitterUser.name,
      twitterAccessToken: oauth_token,
      twitterAccessTokenSecret: oauth_token_secret,
    }).onConflictDoUpdate({
      target: userSchema.id,
      set: {
        twitterUserId: user_id,
        twitterUsername: screen_name,
        twitterDisplayName: twitterUser.name,
        twitterAccessToken: oauth_token,
        twitterAccessTokenSecret: oauth_token_secret,
        // id is not updated
      }
    });

    // Clear the cookie
    cookies().delete('twitter_oauth_secret');

    return NextResponse.redirect(`${appBaseUrl}/?twitter_connected=true`);

  } catch (error) {
    console.error('Error in twitter auth callback:', error);
    // Clear the cookie on error too
    cookies().delete('twitter_oauth_secret');
    return NextResponse.redirect(`${appBaseUrl}/?error=twitter_auth_failed&reason=server_error`);
  }
} 