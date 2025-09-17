/**
 * Analysis utilities for conversation metrics computation
 */

export interface TranscriptMessage {
  speaker: string;
  message: string;
  timestamp?: number;
}

export interface AnalysisMetrics {
  talkTimeRatio: number;
  fillerWordsCount: number;
  speakingPaceWpm: number;
  sentimentScore: number;
}

/**
 * Calculate talk time ratio - percentage of time the user spoke vs other speakers
 */
export function calculateTalkTimeRatio(transcript: TranscriptMessage[]): number {
  if (!transcript || transcript.length === 0) return 0;

  const userMessages = transcript.filter(msg =>
    msg.speaker.toLowerCase().includes('user') ||
    msg.speaker.toLowerCase().includes('you') ||
    msg.speaker.toLowerCase().includes('speaker_1')
  );

  const totalMessages = transcript.length;
  const userMessageCount = userMessages.length;

  // Simple ratio based on message count (could be enhanced with actual timing data)
  return totalMessages > 0 ? (userMessageCount / totalMessages) : 0;
}

/**
 * Count filler words in transcript
 */
export function countFillerWords(transcript: TranscriptMessage[]): number {
  const fillerWords = [
    'um', 'uh', 'er', 'ah', 'like', 'you know', 'sort of', 'kind of',
    'basically', 'actually', 'literally', 'totally', 'right?', 'okay?',
    'so', 'well', 'i mean', 'you see', 'let me think'
  ];

  const text = extractTranscriptText(transcript).toLowerCase();
  let count = 0;

  fillerWords.forEach(filler => {
    // Use word boundaries to avoid partial matches
    const regex = new RegExp(`\\b${filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = text.match(regex);
    count += matches ? matches.length : 0;
  });

  return count;
}

/**
 * Calculate overall sentiment score (0-1, where 0.5 is neutral)
 */
export function calculateSentimentScore(transcript: TranscriptMessage[]): number {
  const text = extractTranscriptText(transcript).toLowerCase();

  // Simple sentiment analysis using keyword lists
  const positiveWords = [
    'great', 'excellent', 'good', 'amazing', 'wonderful', 'fantastic',
    'perfect', 'love', 'like', 'enjoy', 'happy', 'pleased', 'satisfied',
    'confident', 'excited', 'interested', 'impressive', 'outstanding'
  ];

  const negativeWords = [
    'bad', 'terrible', 'awful', 'horrible', 'hate', 'dislike', 'angry',
    'frustrated', 'disappointed', 'concerned', 'worried', 'difficult',
    'problem', 'issue', 'challenging', 'confusing', 'unclear', 'wrong'
  ];

  let positiveCount = 0;
  let negativeCount = 0;

  positiveWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = text.match(regex);
    positiveCount += matches ? matches.length : 0;
  });

  negativeWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = text.match(regex);
    negativeCount += matches ? matches.length : 0;
  });

  const totalSentimentWords = positiveCount + negativeCount;

  if (totalSentimentWords === 0) return 0.5; // Neutral

  // Calculate sentiment score (0-1 scale)
  const sentimentRatio = positiveCount / totalSentimentWords;
  return sentimentRatio;
}

/**
 * Calculate speaking pace in words per minute
 */
export function calculateSpeakingPace(transcript: TranscriptMessage[], durationSeconds: number): number {
  if (!durationSeconds || durationSeconds <= 0) return 0;

  const text = extractTranscriptText(transcript);
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;

  const durationMinutes = durationSeconds / 60;
  return durationMinutes > 0 ? Math.round(wordCount / durationMinutes) : 0;
}

/**
 * Extract plain text from transcript message array
 */
export function extractTranscriptText(transcript: TranscriptMessage[]): string {
  if (!transcript || transcript.length === 0) return '';

  return transcript
    .map(msg => msg.message)
    .join(' ')
    .trim();
}

/**
 * Safely parse and validate GPT-4o analysis response
 */
export function parseAnalysisResponse(response: string): any {
  try {
    const parsed = JSON.parse(response);

    // Validate that required fields exist
    const requiredFields = ['overallScore', 'strengths', 'areasForImprovement'];
    const hasRequiredFields = requiredFields.every(field =>
      parsed.hasOwnProperty(field) && parsed[field] !== undefined
    );

    if (!hasRequiredFields) {
      console.warn('Analysis response missing required fields:', requiredFields);
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('Failed to parse analysis response:', error);
    return null;
  }
}

/**
 * Generate comprehensive analysis metrics
 */
export function generateAnalysisMetrics(
  transcript: TranscriptMessage[],
  durationSeconds: number
): AnalysisMetrics {
  return {
    talkTimeRatio: calculateTalkTimeRatio(transcript),
    fillerWordsCount: countFillerWords(transcript),
    speakingPaceWpm: calculateSpeakingPace(transcript, durationSeconds),
    sentimentScore: calculateSentimentScore(transcript)
  };
}

/**
 * Create mock transcript for demo purposes
 */
export function createMockTranscript(): TranscriptMessage[] {
  return [
    {
      speaker: "user",
      message: "Hi there! I'm really excited to talk about our new product. It's absolutely amazing and I think you'll love it."
    },
    {
      speaker: "client",
      message: "Tell me more about it. What makes it special?"
    },
    {
      speaker: "user",
      message: "Well, um, it's like really good because, you know, it solves the main problem that, uh, most people have."
    },
    {
      speaker: "client",
      message: "I see. Can you be more specific about the problem it solves?"
    },
    {
      speaker: "user",
      message: "Absolutely! It basically saves time and, sort of, makes everything more efficient for your team."
    }
  ];
}