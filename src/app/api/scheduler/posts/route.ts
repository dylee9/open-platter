import { db } from '@/lib/db';
import { scheduledPosts } from '@/lib/db/schema';
import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const posts = await db.select().from(scheduledPosts).orderBy(desc(scheduledPosts.createdAt));
    return NextResponse.json(posts);
  } catch (error) {
    console.error('Error fetching scheduled posts:', error);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const text = formData.get('text') as string;
    const scheduledTime = formData.get('scheduled_time') as string;
    const communityId = formData.get('community_id') as string | null;
    const files = formData.getAll('files') as File[];

    const mediaUrls: string[] = [];
    if (files.length > 0) {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      await fs.mkdir(uploadDir, { recursive: true });

      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = `${Date.now()}-${file.name}`;
        await fs.writeFile(path.join(uploadDir, filename), buffer);
        mediaUrls.push(`/uploads/${filename}`);
      }
    }

    const newPost = {
      text,
      scheduledTime: new Date(scheduledTime),
      communityId,
      mediaUrls: JSON.stringify(mediaUrls),
    };

    const inserted = await db.insert(scheduledPosts).values(newPost).returning();

    return NextResponse.json(inserted[0]);
  } catch (error) {
    console.error('Error creating scheduled post:', error);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    // Get all posts to delete their media files
    const allPosts = await db.select().from(scheduledPosts);
    
    // Delete associated media files
    for (const post of allPosts) {
      if (post.mediaUrls) {
        try {
          const mediaFiles: string[] = JSON.parse(post.mediaUrls);
          for (const mediaFile of mediaFiles) {
            try {
              await fs.unlink(path.join(process.cwd(), 'public', mediaFile));
            } catch (e) {
              console.error(`Failed to delete media file: ${mediaFile}`, e);
            }
          }
        } catch (e) {
          console.error('Error parsing media URLs:', e);
        }
      }
    }

    // Delete all posts from database
    await db.delete(scheduledPosts);
    
    return NextResponse.json({ message: 'All scheduled posts deleted successfully' });
  } catch (error) {
    console.error('Error deleting all scheduled posts:', error);
    return NextResponse.json({ error: 'Failed to delete all posts' }, { status: 500 });
  }
} 