import cron from 'node-cron';
import * as dotenv from 'dotenv';
import path from 'path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../src/lib/db/schema';
import { postTweet, uploadMedia } from '../src/lib/twitter-api-client';
import { and, lte, eq } from 'drizzle-orm';
import fs from 'fs/promises';

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const sqlite = new Database(path.join(__dirname, '../sqlite.db'));
const db = drizzle(sqlite, { schema });

const CRON_INTERVAL_MINUTES = 5;

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

async function updatePostStatus(postId: number, status: string, twitterPostId?: string, errorMessage?: string) {
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
            const uploadResult = await uploadMedia(buffer, user.twitterAccessToken, user.twitterAccessTokenSecret);
            if (uploadResult) {
              mediaIds.push(uploadResult.media_id_string);
            }
          } catch (e) {
            console.error(`  - ❌ Failed to upload media for post ${post.id}: ${mediaUrl}`, e);
          }
        }
      }

      const result = await postTweet(
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
 