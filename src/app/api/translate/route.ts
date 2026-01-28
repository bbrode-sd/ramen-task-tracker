import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { text, targetLanguage } = await request.json();

    if (!text || !targetLanguage) {
      return NextResponse.json(
        { error: 'Missing text or targetLanguage' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key-here') {
      // Fallback: return placeholder if no API key
      return NextResponse.json({
        translation: targetLanguage === 'ja' 
          ? `[翻訳待ち] ${text}` 
          : `[Awaiting translation] ${text}`,
        isPlaceholder: true,
      });
    }

    const languageName = targetLanguage === 'ja' ? 'Japanese' : 'English';
    const sourceLanguage = targetLanguage === 'ja' ? 'English' : 'Japanese';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional translator. Translate the following ${sourceLanguage} text to ${languageName}. 
Only respond with the translation, nothing else. 
Maintain the same tone and meaning. 
If the text is already in ${languageName}, return it as-is.
For very short phrases or single words, provide the most natural translation.`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const translation = completion.choices[0]?.message?.content?.trim() || text;

    return NextResponse.json({ translation, isPlaceholder: false });
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { error: 'Translation failed' },
      { status: 500 }
    );
  }
}
