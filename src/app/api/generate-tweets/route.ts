import { generateTweetsFromTranscription } from '@/lib/azureopenai';
import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are an expert tweet writer.
Based on the provided transcription of a conversation, generate a list of 5-10 potential tweets.
The tweets should be engaging, concise, and relevant to the key topics in the conversation.
Each tweet must be 280 characters or less.
Return the tweets as a JSON array of strings. For example: ["This is a tweet.", "This is another tweet."].
Do not include any other text or explanation in your response, only the JSON array.`;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    if (file.type !== 'text/plain') {
      return NextResponse.json({ error: 'Only .txt files are allowed.' }, { status: 400 });
    }

    const transcription = await file.text();
    const tweets = await generateTweetsFromTranscription(transcription, SYSTEM_PROMPT);

    return NextResponse.json({ tweets });
  } catch (error) {
    console.error('Error generating tweets:', error);
    return NextResponse.json({ error: 'Failed to generate tweets.' }, { status: 500 });
  }
} 