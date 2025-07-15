import { db } from '@/lib/db';
import { scheduledPosts } from '@/lib/db/schema';
import { NextResponse } from 'next/server';

const DAYS_TO_SCHEDULE = 7;

export async function POST(req: Request) {
  try {
    const { tweets } = await req.json();

    if (!Array.isArray(tweets) || tweets.length === 0) {
      return NextResponse.json({ error: 'No tweets provided.' }, { status: 400 });
    }

    const scheduledPostsData = [];
    const now = new Date();
    
    // Calculate how many tweets per day and distribute evenly
    const totalTweets = tweets.length;
    const baseTweetsPerDay = Math.floor(totalTweets / DAYS_TO_SCHEDULE);
    const extraTweets = totalTweets % DAYS_TO_SCHEDULE;
    
    // Create an array to track how many tweets each day should get
    const tweetsPerDay = Array(DAYS_TO_SCHEDULE).fill(baseTweetsPerDay);
    for (let i = 0; i < extraTweets; i++) {
      tweetsPerDay[i]++;
    }
    
    // Distribute tweets across days using round-robin approach
    let tweetIndex = 0;
    for (let dayOffset = 0; dayOffset < DAYS_TO_SCHEDULE; dayOffset++) {
      const tweetsForThisDay = tweetsPerDay[dayOffset];
      
      if (tweetsForThisDay === 0) continue;
      
      const scheduledDate = new Date(now);
      scheduledDate.setDate(now.getDate() + dayOffset);
      
      // Start at 7am and spread until 11pm (16 hours = 960 minutes)
      const startHour = 7;
      const endHour = 23;
      const totalMinutes = (endHour - startHour) * 60;
      
      // Calculate interval based on actual tweets for this day
      const intervalMinutes = tweetsForThisDay > 1 ? totalMinutes / (tweetsForThisDay - 1) : 0;
      
      for (let postInDay = 0; postInDay < tweetsForThisDay && tweetIndex < totalTweets; postInDay++) {
        const currentDate = new Date(scheduledDate);
        
        const minutesFromStart = postInDay * intervalMinutes;
        const hour = startHour + Math.floor(minutesFromStart / 60);
        const minute = Math.floor(minutesFromStart % 60);
        
        currentDate.setHours(hour, minute, 0, 0);

        scheduledPostsData.push({
          text: tweets[tweetIndex],
          scheduledTime: currentDate,
          status: 'scheduled' as const,
        });
        
        tweetIndex++;
      }
    }

    if (scheduledPostsData.length > 0) {
      await db.insert(scheduledPosts).values(scheduledPostsData);
    }
    
    return NextResponse.json({ message: 'Tweets scheduled successfully', count: scheduledPostsData.length });

  } catch (error) {
    console.error('Error batch scheduling tweets:', error);
    return NextResponse.json({ error: 'Failed to schedule tweets.' }, { status: 500 });
  }
} 