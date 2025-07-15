import OAuth from 'oauth-1.0a';
import CryptoJS from 'crypto-js';

const TWITTER_API_KEY = process.env.TWITTER_API_KEY!;
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET!;

interface TwitterApiResponse {
  data?: {
    id: string;
    text: string;
  };
  errors?: Array<{
    message: string;
    type: string;
  }>;
}

interface PostTweetRequest {
  text: string;
  media?: {
    media_ids: string[];
  };
  community_id?: string;
}

const oauth = new OAuth({
  consumer: { 
    key: TWITTER_API_KEY, 
    secret: TWITTER_API_SECRET 
  },
  signature_method: 'HMAC-SHA1',
  hash_function(base_string: string, key: string) {
    return CryptoJS.HmacSHA1(base_string, key).toString(CryptoJS.enc.Base64);
  },
});

function generateOAuthHeaders(
  method: string, 
  url: string, 
  accessToken: string, 
  accessTokenSecret: string,
  body?: any
): Record<string, string> {
  const token = {
    key: accessToken,
    secret: accessTokenSecret,
  };

  const requestData: OAuth.RequestOptions = {
    url: url,
    method: method,
  };

  // IMPORTANT: For Twitter API v2, do NOT include the request body in the OAuth signature
  // The body should only be included for v1.1 endpoints with form-encoded data
  
  const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

  return {
    'Authorization': authHeader.Authorization,
    'Content-Type': 'application/json',
  };
}

export async function postTweet(
  text: string, 
  accessToken: string, 
  accessTokenSecret: string,
  mediaIds: string[] = [],
  communityId?: string
): Promise<TwitterApiResponse> {
  const url = 'https://api.twitter.com/2/tweets';
  const payload: PostTweetRequest = { text };

  if (mediaIds.length > 0) {
    payload.media = {
      media_ids: mediaIds
    };
  }

  if (communityId) {
    payload.community_id = communityId;
  }

  try {
    const headers = generateOAuthHeaders('POST', url, accessToken, accessTokenSecret, payload);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    const result = await response.json() as TwitterApiResponse;
    
    if (!response.ok) {
      console.error(`Failed to post tweet. Status: ${response.status}`);
      console.error(`Response headers:`, Object.fromEntries(response.headers.entries()));
      console.error(`Response body:`, JSON.stringify(result, null, 2));
      
      // Add specific error information for common 401 scenarios
      if (response.status === 401) {
        console.error('🔐 401 Unauthorized - Possible causes:');
        console.error('1. Invalid or expired access tokens');
        console.error('2. App permissions not set to "Read and Write"');
        console.error('3. OAuth signature generation error');
        console.error('4. Twitter API credentials mismatch');
      }
      
      return result;
    }

    return result;
  } catch (error) {
    console.error('Error posting tweet:', error);
    return { 
      errors: [{ 
        message: error instanceof Error ? error.message : 'Unknown error', 
        type: 'network_error' 
      }] 
    };
  }
}

// NOTE: Media upload for v2 API requires chunked upload and is more complex.
// This is a simplified version for v1.1 endpoint, which is still widely used for media.
// For a full v2 implementation, refer to Twitter's official documentation.
export async function uploadMedia(
  media: Buffer,
  accessToken: string,
  accessTokenSecret: string
): Promise<{ media_id_string: string } | null> {
  const url = 'https://upload.twitter.com/1.1/media/upload.json';
  
  const token = {
    key: accessToken,
    secret: accessTokenSecret,
  };
  
  // For multipart/form-data, the body is not included in the signature.
  const authHeader = oauth.toHeader(oauth.authorize({ url, method: 'POST' }, token));

  const formData = new FormData();
  formData.append('media', new Blob([media]));
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader.Authorization,
        // Content-Type is set automatically by the browser/fetch with FormData
      },
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      console.error(`Failed to upload media. Status: ${response.status}`, result);
      return null;
    }

    return result;

  } catch (error) {
    console.error('Error uploading media:', error);
    return null;
  }
} 