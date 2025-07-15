import { db } from '@/lib/db';
import { scheduledPosts } from '@/lib/db/schema';
import { NextResponse } from 'next/server';

const POSTS_PER_DAY = 5;
const DAYS_TO_SCHEDULE = 7;

export async function POST(req: Request) {
  try {
    const { tweets } = await req.json();

    if (!Array.isArray(tweets) || tweets.length === 0) {
      return NextResponse.json({ error: 'No tweets provided.' }, { status: 400 });
    }

    const scheduledPostsData = [];
    const now = new Date();
    let currentDay = 0;
    
    // Distribute tweets over the next 7 days
    for (let i = 0; i < tweets.length; i++) {
      const dayOffset = Math.floor(i / POSTS_PER_DAY) % DAYS_TO_SCHEDULE;
      const postIndexInDay = i % POSTS_PER_DAY;
      
      const scheduledDate = new Date(now);
      scheduledDate.setDate(now.getDate() + dayOffset);
      
      // Spread posts throughout the day (e.g., 9am, 12pm, 3pm, 6pm, 9pm)
      const hour = 9 + (postIndexInDay * 3);
      scheduledDate.setHours(hour, 0, 0, 0);

      scheduledPostsData.push({
        text: tweets[i],
        scheduledTime: scheduledDate,
        status: 'scheduled' as const,
      });
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