import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import pokemonNames from '@/data/pokemon-names.json';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Type for the pokemon names lookup
interface PokemonLookup {
  en_to_ja: Record<string, string>;
  ja_to_en: Record<string, string>;
}

const pokemonLookup = pokemonNames as PokemonLookup;

// Context mode type
type ContextMode = 'general' | 'pokemon' | 'custom';

// Post-process translation to ensure correct Pokémon names (only for pokemon context)
function correctPokemonNames(text: string, targetLanguage: 'en' | 'ja', contextMode: ContextMode): string {
  if (contextMode !== 'pokemon') {
    return text;
  }
  
  let corrected = text;
  
  if (targetLanguage === 'ja') {
    // Replace English Pokémon names with official Japanese names
    for (const [enName, jaName] of Object.entries(pokemonLookup.en_to_ja)) {
      // Case-insensitive replacement for English names
      const regex = new RegExp(`\\b${enName}\\b`, 'gi');
      corrected = corrected.replace(regex, jaName);
    }
  } else {
    // Replace Japanese Pokémon names with official English names
    for (const [jaName, enName] of Object.entries(pokemonLookup.ja_to_en)) {
      corrected = corrected.replace(new RegExp(jaName, 'g'), enName);
    }
  }
  
  return corrected;
}

// General translation context
const GENERAL_TRANSLATION_CONTEXT = `
You are a professional translator providing high-quality translations between English and Japanese.
Translate naturally while maintaining the original tone and meaning.
For short phrases or single words, provide the most natural translation in the target language.
`;

// Pokémon-specialized translation instructions
const POKEMON_TRANSLATION_CONTEXT = `
You are a professional translator specializing in Pokémon game localization.

CRITICAL: When translating Pokémon-related content, you MUST use the official localized names from the Pokémon games. Do NOT phonetically translate or romanize - use the exact official terms.

Key terminology categories that require official translations:
1. **Pokémon Names**: Use official localized names (e.g., Pikachu/ピカチュウ, Charizard/リザードン, Eevee/イーブイ, Mewtwo/ミュウツー)
2. **Move Names**: Use official move names (e.g., Thunderbolt/10まんボルト, Flamethrower/かえんほうしゃ, Ice Beam/れいとうビーム, Earthquake/じしん)
3. **Ability Names**: Use official ability names (e.g., Levitate/ふゆう, Intimidate/いかく, Overgrow/しんりょく, Blaze/もうか)
4. **Held Items**: Use official item names (e.g., Leftovers/たべのこし, Choice Band/こだわりハチマキ, Choice Scarf/こだわりスカーフ, Life Orb/いのちのたま, Focus Sash/きあいのタスキ)
5. **Types**: Use official type names (e.g., Dragon/ドラゴン, Fairy/フェアリー, Steel/はがね, Ghost/ゴースト)
6. **Stats**: Use official stat abbreviations (e.g., HP, Attack/こうげき, Defense/ぼうぎょ, Sp. Atk/とくこう, Sp. Def/とくぼう, Speed/すばやさ)
7. **Natures**: Use official nature names (e.g., Adamant/いじっぱり, Jolly/ようき, Modest/ひかえめ, Timid/おくびょう)
8. **Status Conditions**: Use official terms (e.g., Paralysis/まひ, Burn/やけど, Poison/どく, Sleep/ねむり, Freeze/こおり)
9. **Game Terms**: EVs/努力値, IVs/個体値, Shiny/色違い, etc.

When you encounter any Pokémon terminology, recall the official localization used in the games. If unsure about a specific term, prioritize accuracy over literal translation.

For non-Pokémon content in the text, translate naturally and maintain the original tone.
`;

// Get the appropriate translation context based on mode
function getTranslationContext(contextMode: ContextMode, customContext?: string): string {
  switch (contextMode) {
    case 'general':
      return GENERAL_TRANSLATION_CONTEXT;
    case 'pokemon':
      return POKEMON_TRANSLATION_CONTEXT;
    case 'custom':
      return customContext?.trim() 
        ? `You are a professional translator. ${customContext}\n\nTranslate naturally while maintaining the original tone and meaning.`
        : GENERAL_TRANSLATION_CONTEXT;
    default:
      return GENERAL_TRANSLATION_CONTEXT;
  }
}

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
    const { 
      text, 
      targetLanguage, 
      autoDetect,
      contextMode = 'pokemon',
      customContext = '',
    } = await request.json();

    const translationContext = getTranslationContext(contextMode as ContextMode, customContext);

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
            content: `${translationContext}

Translate the following ${sourceLanguageName} text to ${targetLanguageName}. 
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
        temperature: 0.2,
        max_tokens: 1000,
      });

      const rawTranslation = completion.choices[0]?.message?.content?.trim() || text;
      const translation = correctPokemonNames(rawTranslation, translateTo, contextMode as ContextMode);

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
          content: `${translationContext}

Translate the following ${sourceLanguage} text to ${languageName}. 
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
      temperature: 0.2,
      max_tokens: 1000,
    });

    const rawTranslation = completion.choices[0]?.message?.content?.trim() || text;
    const translation = correctPokemonNames(rawTranslation, targetLanguage as 'en' | 'ja', contextMode as ContextMode);

    return NextResponse.json({ translation, isPlaceholder: false });
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { error: 'Translation failed' },
      { status: 500 }
    );
  }
}
