import OAuth from 'oauth-1.0a';
import CryptoJS from 'crypto-js';

// Environment variables
const TWITTER_API_KEY = process.env.TWITTER_API_KEY!;
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET!;

interface TwitterOAuthConfig {
  consumerKey: string;
  consumerSecret: string;
}

interface TwitterRequestTokenResponse {
  oauth_token: string;
  oauth_token_secret: string;
  oauth_callback_confirmed: string;
}

interface TwitterAccessTokenResponse {
  oauth_token: string;
  oauth_token_secret: string;
  user_id: string;
  screen_name: string;
}

interface TwitterUserResponse {
  id: number;
  id_str: string;
  name: string;
  screen_name: string;
  location: string;
  description: string;
  followers_count: number;
  friends_count: number;
  profile_image_url_https: string;
  verified: boolean;
}

class TwitterOAuthService {
  private oauth: OAuth;
  private config: TwitterOAuthConfig;

  constructor() {
    // Validate environment variables
    if (!TWITTER_API_KEY || !TWITTER_API_SECRET) {
      console.error('Missing Twitter API credentials!');
      console.error('TWITTER_API_KEY:', TWITTER_API_KEY ? 'SET' : 'MISSING');
      console.error('TWITTER_API_SECRET:', TWITTER_API_SECRET ? 'SET' : 'MISSING');
      throw new Error('Twitter API credentials are required');
    }

    this.config = {
      consumerKey: TWITTER_API_KEY,
      consumerSecret: TWITTER_API_SECRET,
    };

    this.oauth = new OAuth({
      consumer: { 
        key: this.config.consumerKey, 
        secret: this.config.consumerSecret 
      },
      signature_method: 'HMAC-SHA1',
      hash_function(base_string: string, key: string) {
        return CryptoJS.HmacSHA1(base_string, key).toString(CryptoJS.enc.Base64);
      },
    });

    console.log('TwitterOAuthService initialized with consumer key:', this.config.consumerKey.substring(0, 8) + '...');
  }

  /**
   * Step 1: Get request token for OAuth flow
   */
  async getRequestToken(callbackUrl: string): Promise<TwitterRequestTokenResponse> {
    console.log('Requesting OAuth token with callback URL:', callbackUrl);
    
    const requestData = {
      url: 'https://api.twitter.com/oauth/request_token',
      method: 'POST',
      data: { oauth_callback: callbackUrl },
    };

    const authorizationData = this.oauth.authorize(requestData);
    const headers = this.oauth.toHeader(authorizationData);

    console.log('Authorization header:', headers.Authorization.substring(0, 50) + '...');

    const response = await fetch(requestData.url, {
      method: 'POST',
      headers: {
        'Authorization': headers.Authorization,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ oauth_callback: callbackUrl }).toString(),
    });

    console.log('Twitter response status:', response.status);
    console.log('Twitter response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Twitter error response:', errorText);
      
      // Provide more specific error messages
      if (response.status === 403) {
        throw new Error(`Twitter API 403 Forbidden. Common causes:
1. Invalid API key/secret
2. App permissions are "Read only" instead of "Read and Write"
3. Callback URL not whitelisted in Twitter app settings
4. OAuth 1.0a not enabled in app settings
Response: ${errorText}`);
      }
      
      throw new Error(`Failed to get request token: ${response.status} ${response.statusText}. Response: ${errorText}`);
    }

    const responseText = await response.text();
    console.log('Twitter response:', responseText);
    
    const params = new URLSearchParams(responseText);
    
    return {
      oauth_token: params.get('oauth_token')!,
      oauth_token_secret: params.get('oauth_token_secret')!,
      oauth_callback_confirmed: params.get('oauth_callback_confirmed')!,
    };
  }

  /**
   * Step 2: Generate authorization URL
   */
  getAuthorizationUrl(oauthToken: string): string {
    return `https://api.twitter.com/oauth/authorize?oauth_token=${oauthToken}`;
  }

  /**
   * Step 3: Exchange oauth_verifier for access token
   */
  async getAccessToken(
    oauthToken: string, 
    oauthTokenSecret: string, 
    oauthVerifier: string
  ): Promise<TwitterAccessTokenResponse> {
    const requestData = {
      url: 'https://api.twitter.com/oauth/access_token',
      method: 'POST',
    };

    const token = {
      key: oauthToken,
      secret: oauthTokenSecret,
    };

    const headers = this.oauth.toHeader(this.oauth.authorize(requestData, token));

    const response = await fetch(requestData.url, {
      method: 'POST',
      headers: {
        'Authorization': headers.Authorization,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ oauth_verifier: oauthVerifier }).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Twitter access token error:', errorText);
      throw new Error(`Failed to get access token: ${response.status} ${response.statusText}. Response: ${errorText}`);
    }

    const responseText = await response.text();
    const params = new URLSearchParams(responseText);
    
    return {
      oauth_token: params.get('oauth_token')!,
      oauth_token_secret: params.get('oauth_token_secret')!,
      user_id: params.get('user_id')!,
      screen_name: params.get('screen_name')!,
    };
  }

  /**
   * Get user profile information
   */
  async getUserProfile(accessToken: string, accessTokenSecret: string): Promise<TwitterUserResponse> {
    const requestData = {
      url: 'https://api.twitter.com/1.1/account/verify_credentials.json',
      method: 'GET',
    };

    const token = {
      key: accessToken,
      secret: accessTokenSecret,
    };

    const headers = this.oauth.toHeader(this.oauth.authorize(requestData, token));

    const response = await fetch(requestData.url, {
      method: 'GET',
      headers: {
        'Authorization': headers.Authorization,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Twitter user profile error:', errorText);
      throw new Error(`Failed to get user profile: ${response.status} ${response.statusText}. Response: ${errorText}`);
    }

    return await response.json();
  }
}

export const twitterOAuth = new TwitterOAuthService();
export type { TwitterRequestTokenResponse, TwitterAccessTokenResponse, TwitterUserResponse }; 