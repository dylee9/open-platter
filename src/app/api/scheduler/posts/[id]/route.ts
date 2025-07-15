import { db } from '@/lib/db';
import { scheduledPosts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const postId = parseInt(params.id, 10);
    const formData = await req.formData();
    const text = formData.get('text') as string;
    const scheduledTime = formData.get('scheduled_time') as string;
    const communityId = formData.get('community_id') as string | null;
    const files = formData.getAll('files') as File[];

    // First, get the existing post to see if there are old media files to delete
    const existingPost = await db.select().from(scheduledPosts).where(eq(scheduledPosts.id, postId));
    if (existingPost.length === 0) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const mediaUrls: string[] = [];
    if (files.length > 0) {
      // If new files are uploaded, delete old ones
      if (existingPost[0].mediaUrls) {
        const oldMedia: string[] = JSON.parse(existingPost[0].mediaUrls);
        for (const oldFile of oldMedia) {
          try {
            await fs.unlink(path.join(process.cwd(), 'public', oldFile));
          } catch (e) {
            console.error(`Failed to delete old media file: ${oldFile}`, e);
          }
        }
      }

      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      await fs.mkdir(uploadDir, { recursive: true });

      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = `${Date.now()}-${file.name}`;
        await fs.writeFile(path.join(uploadDir, filename), buffer);
        mediaUrls.push(`/uploads/${filename}`);
      }
    } else {
      // If no new files, keep the old ones
      if (existingPost[0].mediaUrls) {
        mediaUrls.push(...JSON.parse(existingPost[0].mediaUrls));
      }
    }

    const updatedPost = {
      text,
      scheduledTime: new Date(scheduledTime),
      communityId,
      mediaUrls: JSON.stringify(mediaUrls),
      updatedAt: new Date(),
    };

    const result = await db.update(scheduledPosts)
      .set(updatedPost)
      .where(eq(scheduledPosts.id, postId))
      .returning();

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error(`Error updating post ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const postId = parseInt(params.id, 10);

    // Also delete associated media files
    const existingPost = await db.select().from(scheduledPosts).where(eq(scheduledPosts.id, postId));
    if (existingPost.length > 0 && existingPost[0].mediaUrls) {
      const oldMedia: string[] = JSON.parse(existingPost[0].mediaUrls);
      for (const oldFile of oldMedia) {
        try {
          await fs.unlink(path.join(process.cwd(), 'public', oldFile));
        } catch (e) {
          console.error(`Failed to delete media file: ${oldFile}`, e);
        }
      }
    }

    await db.delete(scheduledPosts).where(eq(scheduledPosts.id, postId));
    return NextResponse.json({ message: 'Post deleted' });
  } catch (error) {
    console.error(`Error deleting post ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }
} 