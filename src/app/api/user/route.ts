import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const result = await db.select().from(user).where(eq(user.id, 1));
    if (result.length > 0) {
      return NextResponse.json({ user: result[0] });
    }
    return NextResponse.json({ user: null }, { status: 404 });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await db.delete(user).where(eq(user.id, 1));
    return NextResponse.json({ message: 'User disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting user:', error);
    return NextResponse.json({ error: 'Failed to disconnect user' }, { status: 500 });
  }
} 