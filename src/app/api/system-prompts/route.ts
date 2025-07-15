import { db } from '@/lib/db';
import { systemPrompts } from '@/lib/db/schema';
import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    const prompts = await db.select().from(systemPrompts).orderBy(desc(systemPrompts.createdAt));
    return NextResponse.json(prompts);
  } catch (error) {
    console.error('Error fetching system prompts:', error);
    return NextResponse.json({ error: 'Failed to fetch system prompts' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, prompt, isDefault = false } = body;

    if (!name || !prompt) {
      return NextResponse.json({ error: 'Name and prompt are required' }, { status: 400 });
    }

    // If this is being set as default, remove default from others
    if (isDefault) {
      await db.update(systemPrompts).set({ isDefault: false });
    }

    const newPrompt = {
      name,
      prompt,
      isDefault,
    };

    const inserted = await db.insert(systemPrompts).values(newPrompt).returning();
    return NextResponse.json(inserted[0]);
  } catch (error) {
    console.error('Error creating system prompt:', error);
    return NextResponse.json({ error: 'Failed to create system prompt' }, { status: 500 });
  }
} 