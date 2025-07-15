const Database = require('better-sqlite3');
const db = new Database('sqlite.db');

console.log('📋 Checking scheduled posts in database...\n');

try {
  const posts = db.prepare(`
    SELECT id, text, status, scheduled_time, error_message, twitter_post_id
    FROM scheduled_posts 
    ORDER BY scheduled_time DESC 
    LIMIT 10
  `).all();
  
  if (posts.length === 0) {
    console.log('No scheduled posts found in database');
  } else {
    console.log(`Found ${posts.length} scheduled posts:\n`);
    posts.forEach((post, index) => {
      console.log(`${index + 1}. Post ID: ${post.id}`);
      console.log(`   Text: ${post.text.substring(0, 100)}...`);
      console.log(`   Status: ${post.status}`);
      console.log(`   Scheduled: ${new Date(post.scheduled_time).toISOString()}`);
      if (post.error_message) {
        console.log(`   Error: ${post.error_message}`);
      }
      if (post.twitter_post_id) {
        console.log(`   Twitter ID: ${post.twitter_post_id}`);
      }
      console.log('');
    });
  }
} catch (error) {
  console.error('Error checking posts:', error);
} finally {
  db.close();
} 