const Database = require('better-sqlite3');
const db = new Database('sqlite.db');

console.log('📝 Updating scheduled post for testing...\n');

try {
  // Update post ID 11 to have a recent timestamp (1 minute ago)
  const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);
  
  const result = db.prepare(`
    UPDATE scheduled_posts 
    SET scheduled_time = ?, status = 'scheduled', updated_at = ?
    WHERE id = 11
  `).run(oneMinuteAgo.getTime(), new Date().getTime());
  
  if (result.changes > 0) {
    console.log(`✅ Updated post ID 11 to be scheduled for: ${oneMinuteAgo.toISOString()}`);
    console.log(`   This post should now be processed by the scheduler.`);
    console.log(`   Current time: ${new Date().toISOString()}`);
  } else {
    console.log('❌ No post was updated');
  }
} catch (error) {
  console.error('Error updating post:', error);
} finally {
  db.close();
} 