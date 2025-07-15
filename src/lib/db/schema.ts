import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const user = sqliteTable('user', {
  id: integer('id').primaryKey(),
  twitterUserId: text('twitter_user_id'),
  twitterUsername: text('twitter_username'),
  twitterDisplayName: text('twitter_display_name'),
  twitterAccessToken: text('twitter_access_token'),
  twitterAccessTokenSecret: text('twitter_access_token_secret'),
});

export const scheduledPosts = sqliteTable('scheduled_posts', {
  id: integer('id').primaryKey(),
  text: text('text').notNull(),
  mediaUrls: text('media_urls'), // JSON string array
  communityId: text('community_id'),
  scheduledTime: integer('scheduled_time', { mode: 'timestamp' }).notNull(),
  status: text('status', { enum: ['scheduled', 'posted', 'failed', 'cancelled'] }).default('scheduled').notNull(),
  twitterPostId: text('twitter_post_id'),
  errorMessage: text('error_message'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

export const communityTags = sqliteTable('community_tags', {
  id: integer('id').primaryKey(),
  tagName: text('tag_name').notNull(),
  communityId: text('community_id').notNull(),
  communityName: text('community_name'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

export const systemPrompts = sqliteTable('system_prompts', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  prompt: text('prompt').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}); 