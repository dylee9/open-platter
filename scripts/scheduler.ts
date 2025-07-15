import cron from 'node-cron';
import * as dotenv from 'dotenv';
import path from 'path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../src/lib/db/schema';
import { and, lte, eq } from 'drizzle-orm';
import fs from 'fs/promises';
const OAuth = require('oauth-1.0a');
import * as CryptoJS from 'crypto-js';

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Add validation and debug logging for environment variables
const TWITTER_API_KEY = process.env.TWITTER_API_KEY;
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET;

console.log('🔧 Environment validation:');
console.log('- TWITTER_API_KEY:', TWITTER_API_KEY ? 'SET' : 'MISSING');
console.log('- TWITTER_API_SECRET:', TWITTER_API_SECRET ? 'SET' : 'MISSING');

if (!TWITTER_API_KEY || !TWITTER_API_SECRET) {
  console.error('❌ Twitter API credentials are missing! Please check your .env.local file.');
  process.exit(1);
}

const sqlite = new Database(path.join(__dirname, '../sqlite.db'));
const db = drizzle(sqlite, { schema });

const CRON_INTERVAL_MINUTES = 5;

// Twitter API interfaces and client (copied from working scheduler-cron.ts)
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

class TwitterApiClient {
  private oauth: any;

  constructor() {
    this.oauth = new OAuth({
      consumer: { 
        key: TWITTER_API_KEY, 
        secret: TWITTER_API_SECRET 
      },
      signature_method: 'HMAC-SHA1',
      hash_function(base_string: string, key: string) {
        return CryptoJS.HmacSHA1(base_string, key).toString(CryptoJS.enc.Base64);
      },
    });
  }

  private generateOAuthHeaders(
    method: string, 
    url: string, 
    accessToken: string, 
    accessTokenSecret: string
  ): Record<string, string> {
    const token = {
      key: accessToken,
      secret: accessTokenSecret,
    };

    const authHeader = this.oauth.toHeader(this.oauth.authorize({
      url: url,
      method: method,
    }, token));

    return {
      'Authorization': authHeader.Authorization,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Post a tweet with optional media and community ID
   */
  async postTweet(
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
      const headers = this.generateOAuthHeaders('POST', url, accessToken, accessTokenSecret);
      
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

  /**
   * Upload media (using v1.1 endpoint)
   */
  async uploadMedia(
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
    const authHeader = this.oauth.toHeader(this.oauth.authorize({ url, method: 'POST' }, token));

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
}

// Create Twitter API client instance
const twitterClient = new TwitterApiClient();

async function getDueScheduledPosts() {
  const now = new Date();
  return db.select()
    .from(schema.scheduledPosts)
    .where(and(
      eq(schema.scheduledPosts.status, 'scheduled'),
      lte(schema.scheduledPosts.scheduledTime, now)
    ));
}

async function getUser() {
  const result = await db.select().from(schema.user).where(eq(schema.user.id, 1));
  return result[0];
}

async function testTwitterCredentials(accessToken: string, accessTokenSecret: string): Promise<boolean> {
  try {
    // Test the credentials by making a simple API call to verify credentials
    const url = 'https://api.twitter.com/1.1/account/verify_credentials.json';
    const oauth = new (require('oauth-1.0a'))({
      consumer: { 
        key: TWITTER_API_KEY, 
        secret: TWITTER_API_SECRET 
      },
      signature_method: 'HMAC-SHA1',
      hash_function(base_string: string, key: string) {
        return require('crypto-js').HmacSHA1(base_string, key).toString(require('crypto-js').enc.Base64);
      },
    });

    const token = {
      key: accessToken,
      secret: accessTokenSecret,
    };

    const authHeader = oauth.toHeader(oauth.authorize({ url, method: 'GET' }, token));

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authHeader.Authorization,
      },
    });

    if (response.ok) {
      const userData = await response.json();
      console.log('✅ Twitter credentials verified successfully');
      console.log('- Username:', userData.screen_name);
      console.log('- Name:', userData.name);
      return true;
    } else {
      const errorText = await response.text();
      console.error('❌ Twitter credentials verification failed:', response.status, errorText);
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing Twitter credentials:', error);
    return false;
  }
}

async function updatePostStatus(postId: number, status: 'posted' | 'failed', twitterPostId?: string, errorMessage?: string) {
  await db.update(schema.scheduledPosts)
    .set({
      status,
      twitterPostId,
      errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(schema.scheduledPosts.id, postId));
}

async function runCronJob() {
  console.log(`\n🕒 ${new Date().toISOString()} - Starting scheduler cron job...`);

  const user = await getUser();
  if (!user || !user.twitterAccessToken || !user.twitterAccessTokenSecret) {
    console.log('🛑 No authenticated user found. Skipping cron job.');
    return;
  }

  // Add token validation logging
  console.log('👤 User found:');
  console.log('- Twitter User ID:', user.twitterUserId);
  console.log('- Twitter Username:', user.twitterUsername);
  console.log('- Access Token:', user.twitterAccessToken ? `${user.twitterAccessToken.substring(0, 10)}...` : 'MISSING');
  console.log('- Access Token Secret:', user.twitterAccessTokenSecret ? `${user.twitterAccessTokenSecret.substring(0, 10)}...` : 'MISSING');

  // Test Twitter credentials before processing posts
  console.log('🔍 Testing Twitter credentials...');
  const credentialsValid = await testTwitterCredentials(user.twitterAccessToken, user.twitterAccessTokenSecret);
  
  if (!credentialsValid) {
    console.error('❌ Twitter credentials are invalid or expired. Please re-authenticate.');
    return;
  }

  const postsToProcess = await getDueScheduledPosts();

  if (postsToProcess.length === 0) {
    console.log('📭 No scheduled posts due for posting.');
    return;
  }

  console.log(`🚀 Processing ${postsToProcess.length} scheduled posts...`);

  for (const post of postsToProcess) {
    console.log(`  - Processing post ID: ${post.id}`);
    try {
      let mediaIds: string[] = [];
      if (post.mediaUrls) {
        const mediaUrls = JSON.parse(post.mediaUrls);
        for (const mediaUrl of mediaUrls) {
          try {
            const filePath = path.join(__dirname, '../public', mediaUrl);
            const buffer = await fs.readFile(filePath);
            const uploadResult = await twitterClient.uploadMedia(buffer, user.twitterAccessToken, user.twitterAccessTokenSecret);
            if (uploadResult) {
              mediaIds.push(uploadResult.media_id_string);
            }
          } catch (e) {
            console.error(`  - ❌ Failed to upload media for post ${post.id}: ${mediaUrl}`, e);
          }
        }
      }

      const result = await twitterClient.postTweet(
        post.text,
        user.twitterAccessToken,
        user.twitterAccessTokenSecret,
        mediaIds,
        post.communityId || undefined
      );

      if (result.errors) {
        const errorMessage = result.errors.map(e => e.message).join(', ');
        console.error(`  - ❌ Failed to post tweet for post ${post.id}:`, errorMessage);
        await updatePostStatus(post.id, 'failed', undefined, errorMessage);
      } else if (result.data) {
        console.log(`  - ✅ Successfully posted tweet for post ${post.id}. Tweet ID: ${result.data.id}`);
        await updatePostStatus(post.id, 'posted', result.data.id);
      } else {
        console.error(`  - ❓ Unexpected response for post ${post.id}:`, result);
        await updatePostStatus(post.id, 'failed', undefined, 'Unexpected Twitter API response');
      }

    } catch (error) {
      console.error(`  - 💥 Error processing post ${post.id}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await updatePostStatus(post.id, 'failed', undefined, errorMessage);
    }
  }
  console.log(`🎉 Cron job finished.`);
}

console.log(`🚀 Starting Scheduler Cron Service...`);
console.log(`📅 Schedule: Every ${CRON_INTERVAL_MINUTES} minutes`);

// Run immediately on start for testing
runCronJob();

cron.schedule(`*/${CRON_INTERVAL_MINUTES} * * * *`, () => {
  runCronJob();
});

process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  sqlite.close();
  process.exit(0);
});
 