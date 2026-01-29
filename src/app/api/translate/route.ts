import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to detect if text is primarily Japanese
function detectLanguage(text: string): 'en' | 'ja' {
  // Check for Japanese characters (Hiragana, Katakana, Kanji)
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
  const japaneseMatches = text.match(japaneseRegex);
  
  if (japaneseMatches && japaneseMatches.length > 0) {
    // Count Japanese characters vs total
    const japaneseCount = (text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g) || []).length;
    const totalChars = text.replace(/\s/g, '').length;
    
    // If more than 20% of characters are Japanese, consider it Japanese
    if (japaneseCount / totalChars > 0.2) {
      return 'ja';
    }
  }
  
  return 'en';
}

export async function POST(request: NextRequest) {
  try {
    const { text, targetLanguage, autoDetect } = await request.json();

    // Auto-detect mode: detect language and translate to the other language
    if (autoDetect) {
      if (!text) {
        return NextResponse.json(
          { error: 'Missing text' },
          { status: 400 }
        );
      }

      const detectedLanguage = detectLanguage(text);
      const translateTo = detectedLanguage === 'en' ? 'ja' : 'en';

      if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key-here') {
        // Fallback: return placeholder if no API key
        return NextResponse.json({
          detectedLanguage,
          original: text,
          translation: translateTo === 'ja' 
            ? `[翻訳待ち] ${text}` 
            : `[Awaiting translation] ${text}`,
          isPlaceholder: true,
        });
      }

      const targetLanguageName = translateTo === 'ja' ? 'Japanese' : 'English';
      const sourceLanguageName = detectedLanguage === 'ja' ? 'Japanese' : 'English';

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the following ${sourceLanguageName} text to ${targetLanguageName}. 
Only respond with the translation, nothing else. 
Maintain the same tone and meaning. 
If the text is already in ${targetLanguageName}, return it as-is.
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

      return NextResponse.json({
        detectedLanguage,
        original: text,
        translation,
        isPlaceholder: false,
      });
    }

    // Standard translation mode (existing behavior)
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
