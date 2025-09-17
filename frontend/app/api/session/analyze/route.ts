import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { supabase, TABLES } from '../../../../lib/supabase-backend';
import {
  generateAnalysisMetrics,
  parseAnalysisResponse,
  extractTranscriptText,
  createMockTranscript,
  type TranscriptMessage
} from '../../../../lib/analysis-utils';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface AnalysisRequest {
  sessionId: string;
  transcript?: TranscriptMessage[] | string;
  duration?: number;
  userInfo?: {
    name: string;
    company: string;
    role: string;
  };
}

const SALES_ANALYSIS_PROMPT = `
You are an expert sales coach and trainer. Analyze the provided sales conversation and provide a comprehensive performance assessment.

IMPORTANT: You must respond with ONLY a valid JSON object. Do not include any text before or after the JSON. Your response must be parseable JSON.

Please provide your analysis in the following JSON format:

{
  "overallScore": [number 1-10],
  "title": "[descriptive title for this session type]",
  "strengths": [
    "[strength 1]",
    "[strength 2]",
    "[strength 3]",
    "[strength 4]"
  ],
  "areasForImprovement": [
    "[improvement area 1]",
    "[improvement area 2]",
    "[improvement area 3]",
    "[improvement area 4]"
  ],
  "effectiveTechniques": [
    "[technique 1]",
    "[technique 2]"
  ],
  "techniquesNeedingWork": [
    "[technique 1]",
    "[technique 2]",
    "[technique 3]",
    "[technique 4]"
  ],
  "objectionHandling": {
    "score": [number 1-10],
    "analysis": "[detailed analysis of objection handling performance]"
  },
  "closingEffectiveness": {
    "score": [number 1-10],
    "analysis": "[detailed analysis of closing effectiveness]"
  },
  "keyRecommendations": [
    "[recommendation 1]",
    "[recommendation 2]",
    "[recommendation 3]",
    "[recommendation 4]",
    "[recommendation 5]"
  ],
  "detailedAnalysis": "[comprehensive paragraph analyzing the entire conversation, mentioning specific moments, what worked well, what could be improved, and providing actionable insights]"
}

Focus on:
- Opening and rapport building
- Needs discovery and questioning techniques
- Product/service presentation
- Objection handling
- Closing and next steps
- Overall sales methodology
- Communication skills (clarity, pace, confidence)

Be specific, actionable, and constructive in your feedback.
`;

export async function POST(request: NextRequest) {
  try {
    // Parse request body once
    const body: AnalysisRequest = await request.json();
    const { sessionId, transcript, duration, userInfo } = body;

    // Short-circuit for demo sessions - bypass auth entirely
    if (sessionId?.startsWith('demo-')) {
      const transcriptArray = Array.isArray(transcript) ? transcript : createMockTranscript();
      const metrics = generateAnalysisMetrics(transcriptArray, duration || 300);
      const analysis = generateMockAnalysis(userInfo);
      return NextResponse.json({ analysis, metrics, isDemo: true });
    }

    // Check for authorization
    const authHeader = request.headers.get('authorization');
    const serverSecret = request.headers.get('x-server-secret');

    // For internal server calls, check server secret
    if (serverSecret && serverSecret === process.env.SERVER_SECRET) {
      // Allow internal server calls
    } else if (authHeader) {
      // For external calls, verify user authentication and session ownership
      const token = authHeader.replace('Bearer ', '');
      const userSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: authHeader,
            },
          },
        }
      );

      const { data: { user }, error: authError } = await userSupabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Fetch the profile to get the correct profile.id
      const { data: profile, error: profileError } = await supabase
        .from(TABLES.PROFILES)
        .select('id')
        .eq('auth_id', user.id)
        .single();

      if (profileError || !profile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      }

      // Verify session ownership using profile.id
      const { data: session, error: sessionError } = await supabase
        .from(TABLES.SESSIONS)
        .select('profile_id')
        .eq('id', sessionId)
        .single();

      if (sessionError || !session || session.profile_id !== profile.id) {
        return NextResponse.json({ error: 'Session not found or access denied' }, { status: 404 });
      }
    } else {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️ OpenAI API key not configured - using mock analysis');
      return NextResponse.json({
        analysis: generateMockAnalysis(userInfo),
        isDemo: true
      });
    }

    // Normalize transcript to array format
    let transcriptArray: TranscriptMessage[] = [];
    let transcriptText = '';

    if (typeof transcript === 'string') {
      transcriptText = transcript;
      // Convert string to basic transcript format
      transcriptArray = [{ speaker: 'user', message: transcript }];
    } else if (Array.isArray(transcript)) {
      transcriptArray = transcript;
      transcriptText = extractTranscriptText(transcriptArray);
    }

    // If no meaningful transcript provided, use mock data
    if (!transcriptText || transcriptText.length < 20) {
      console.log('📝 No meaningful transcript provided - generating demo analysis');
      console.log('📝 Transcript length:', transcriptText?.length || 0, 'characters');
      transcriptArray = createMockTranscript();
      transcriptText = extractTranscriptText(transcriptArray);

      // Compute metrics for demo
      const metrics = generateAnalysisMetrics(transcriptArray, duration || 300);
      const mockAnalysis = generateMockAnalysis(userInfo);

      return NextResponse.json({
        analysis: mockAnalysis,
        metrics,
        isDemo: true
      });
    }
    
    console.log('🤖 Using real transcript for GPT-4 analysis:', transcriptText.length, 'characters');

    // Compute structured metrics
    const metrics = generateAnalysisMetrics(transcriptArray, duration || 0);
    console.log('📊 Computed metrics:', metrics);

    // Generate AI analysis using OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: SALES_ANALYSIS_PROMPT
        },
        {
          role: "user",
          content: `
Session ID: ${sessionId}
Duration: ${duration || 'Unknown'} seconds
${userInfo ? `Salesperson: ${userInfo.name} from ${userInfo.company} (${userInfo.role})` : ''}

Conversation transcript:
${transcriptText}

Additional metrics:
- Talk time ratio: ${metrics.talkTimeRatio.toFixed(2)}
- Filler words count: ${metrics.fillerWordsCount}
- Speaking pace: ${metrics.speakingPaceWpm} words/minute
- Sentiment score: ${metrics.sentimentScore.toFixed(2)}

Please analyze this sales conversation and provide detailed feedback.
          `
        }
      ],
      temperature: 0.7,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    });

    const analysisText = completion.choices[0]?.message?.content;
    
    if (!analysisText) {
      throw new Error('No analysis generated by OpenAI');
    }

    try {
      // Parse the JSON response from OpenAI
      const analysis = parseAnalysisResponse(analysisText);

      if (!analysis) {
        throw new Error('Failed to parse analysis response');
      }

      const finalAnalysis = {
        ...analysis,
        id: sessionId,
        duration: Math.floor((duration || 0) / 60), // Convert to minutes
        date: new Date(),
      };

      // 🚀 SAVE ANALYSIS TO DATABASE
      if (!sessionId.startsWith('demo-')) {
        try {
          console.log('💾 Saving analysis to database for session:', sessionId);
          
          // Update session with analysis results and transcript
          const { error: updateError } = await supabase
            .from(TABLES.SESSIONS)
            .update({
              transcript: transcriptArray,
              overall_score: Math.round((analysis.overallScore || 0) * 10),
              feedback_summary: analysis.detailedAnalysis ? analysis.detailedAnalysis.substring(0, 500) + '...' : null,
              session_type: analysis.title || 'Voice Training Session',
              status: 'analyzed',
              processing_status: 'completed',
              analyzed_at: new Date().toISOString()
            })
            .eq('id', sessionId);

          if (updateError) {
            console.error('❌ Failed to update session with analysis:', updateError);
          } else {
            console.log('✅ Analysis saved to database successfully');
          }

          // Fetch session data to get profile_id and company_id for analytics
          const { data: sessionData, error: sessionFetchError } = await supabase
            .from(TABLES.SESSIONS)
            .select('profile_id, company_id')
            .eq('id', sessionId)
            .single();

          if (sessionFetchError) {
            console.error('❌ Failed to fetch session data for analytics:', sessionFetchError);
          }

          // Save detailed analysis to analysis_results table
          const { error: analysisError } = await supabase
            .from(TABLES.ANALYSIS_RESULTS)
            .upsert({
              session_id: sessionId,
              analysis_type: 'gpt-4-sales-coaching',
              provider: 'openai',
              version: '1.0',
              results: finalAnalysis,
              confidence_score: 0.85,
              created_at: new Date().toISOString()
            }, {
              onConflict: 'session_id'
            });

          if (analysisError) {
            console.error('❌ Failed to save detailed analysis:', analysisError);
          }

          // Save structured metrics to session_analytics table
          const { error: metricsError } = await supabase
            .from(TABLES.SESSION_ANALYTICS)
            .upsert({
              session_id: sessionId,
              profile_id: sessionData?.profile_id || null,
              company_id: sessionData?.company_id || null,
              overall_score: Math.round((analysis.overallScore || 0) * 10), // Convert to 0-100 scale
              talk_time_ratio: metrics.talkTimeRatio,
              filler_words_count: metrics.fillerWordsCount,
              speaking_pace_wpm: metrics.speakingPaceWpm,
              sentiment_score: metrics.sentimentScore,
              opening_score: null, // No opening score available in current AI response format
              questioning_score: null,
              objection_handling_score: analysis.objectionHandling?.score ? Math.round(analysis.objectionHandling.score * 10) : null,
              closing_score: analysis.closingEffectiveness?.score ? Math.round(analysis.closingEffectiveness.score * 10) : null,
              session_date: new Date().toISOString().split('T')[0],
              session_hour: new Date().getHours(),
              created_at: new Date().toISOString()
            }, {
              onConflict: 'session_id'
            });

          if (metricsError) {
            console.error('❌ Failed to save metrics:', metricsError);
          }
          
        } catch (dbError) {
          console.error('❌ Database save error:', dbError);
          // Don't fail the request if DB save fails
        }
      }
      
      return NextResponse.json({
        analysis: finalAnalysis,
        metrics,
        isDemo: false
      });
      
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      console.log('Raw OpenAI response:', analysisText);
      
      // Fallback to mock analysis if parsing fails
      const mockAnalysis = generateMockAnalysis(userInfo);
      const fallbackMetrics = generateAnalysisMetrics(transcriptArray, duration || 300);

      return NextResponse.json({
        analysis: mockAnalysis,
        metrics: fallbackMetrics,
        isDemo: true,
        error: 'Failed to parse AI analysis'
      });
    }

  } catch (error) {
    console.error('Error generating session analysis:', error);
    
    // Fallback to mock analysis on any error
    const mockTranscript = createMockTranscript();
    const mockMetrics = generateAnalysisMetrics(mockTranscript, 300);

    return NextResponse.json({
      analysis: generateMockAnalysis(),
      metrics: mockMetrics,
      isDemo: true,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Mock analysis generator for demo/fallback
function generateMockAnalysis(userInfo?: { name: string; company: string; role: string }) {
  const userName = userInfo?.name?.split(' ')[0] || 'the salesperson';
  const company = userInfo?.company || 'the company';
  
  const scenarios = [
    {
      title: 'Sales Discovery Call Analysis',
      overallScore: Math.floor(Math.random() * 3 + 5), // 5-8
      strengths: [
        'Initiated the conversation with a friendly greeting',
        'Expressed interest in understanding the prospect\'s needs',
        'Maintained professional tone throughout the interaction',
        'Showed enthusiasm about the product offering'
      ],
      areasForImprovement: [
        'Lack of detailed questioning to uncover deeper needs',
        'Did not provide specific information about the courses',
        'No attempt to handle potential objections or concerns',
        'Missed opportunity to build rapport by not engaging further'
      ],
      effectiveTechniques: [
        'Friendly greeting and introduction',
        'Open-ended needs assessment questions'
      ],
      techniquesNeedingWork: [
        'Needs discovery',
        'Product presentation', 
        'Objection handling',
        'Closing techniques'
      ],
      objectionHandling: {
        score: 3,
        analysis: 'The conversation did not reach a stage where objections were handled, indicating a lack of depth in the sales process.'
      },
      closingEffectiveness: {
        score: 2,
        analysis: 'There were no closing attempts made during this conversation, suggesting a missed opportunity to advance the sales process.'
      },
      keyRecommendations: [
        'Ask open-ended questions to better understand the prospect\'s specific needs and challenges',
        'Provide detailed information about products that align with the prospect\'s interests',
        'Engage more with the prospect to build rapport and establish a connection',
        'Prepare to handle potential objections by anticipating common concerns',
        'Develop a closing strategy that encourages the prospect to take action'
      ],
      detailedAnalysis: `The salesperson, ${userName}, started the conversation with a friendly greeting, which is a positive approach to establishing initial rapport. However, the interaction lacked depth in terms of needs discovery. ${userName} did not ask further questions to explore the prospect's specific challenges or goals, which would have provided valuable insights for tailoring the presentation. Additionally, there was no detailed information shared about the offerings, leaving the prospect without a clear understanding of the value proposition. The conversation also missed opportunities to build rapport by not engaging with the prospect's introduction or expressing empathy towards their business goals. Overall, the interaction could benefit from more active listening, detailed questioning, and a structured approach to presenting solutions and handling objections.`
    },
    {
      title: 'Product Demo Session Analysis',
      overallScore: Math.floor(Math.random() * 3 + 6), // 6-9
      strengths: [
        'Strong product knowledge demonstration',
        'Clear explanation of key features and benefits',
        'Good use of storytelling to illustrate value',
        'Maintained engagement throughout the presentation'
      ],
      areasForImprovement: [
        'Limited customization based on prospect\'s specific needs',
        'Could have asked more qualifying questions',
        'Presentation was too feature-focused rather than benefit-focused',
        'No clear next steps defined at the end'
      ],
      effectiveTechniques: [
        'Product demonstration with examples',
        'Benefit-focused messaging',
        'Storytelling approach'
      ],
      techniquesNeedingWork: [
        'Needs assessment',
        'Question-based selling',
        'Trial closing',
        'Next step definition'
      ],
      objectionHandling: {
        score: 6,
        analysis: 'Some objections were addressed but could have been handled more systematically with better preparation.'
      },
      closingEffectiveness: {
        score: 4,
        analysis: 'Limited closing attempts were made. The conversation ended without a clear commitment or next step.'
      },
      keyRecommendations: [
        'Customize the demo based on the prospect\'s specific use case and industry',
        'Ask discovery questions before diving into the product demonstration',
        'Focus more on business outcomes rather than technical features',
        'Prepare and practice common objection responses',
        'Always conclude with a clear call-to-action and next steps'
      ],
      detailedAnalysis: `During this product demonstration, ${userName} showed strong product knowledge and was able to articulate key features effectively. The presentation had good energy and maintained the prospect's attention throughout. However, the demo felt somewhat generic and could have been better tailored to the specific prospect's needs and use case. ${userName} spent considerable time on features but could have connected these more directly to business outcomes and ROI. The session would have benefited from more discovery questions at the beginning to understand the prospect's current challenges and desired outcomes. While some objections were addressed, a more structured approach to objection handling would have been more effective. The session ended without a clear next step, which represents a missed opportunity to advance the sales process.`
    }
  ];
  
  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  
  return {
    id: `demo-${Date.now()}`,
    title: scenario.title,
    duration: Math.floor(Math.random() * 10 + 15), // 15-25 minutes
    overallScore: scenario.overallScore,
    date: new Date(),
    strengths: scenario.strengths,
    areasForImprovement: scenario.areasForImprovement,
    effectiveTechniques: scenario.effectiveTechniques,
    techniquesNeedingWork: scenario.techniquesNeedingWork,
    objectionHandling: scenario.objectionHandling,
    closingEffectiveness: scenario.closingEffectiveness,
    keyRecommendations: scenario.keyRecommendations,
    detailedAnalysis: scenario.detailedAnalysis,
  };
}
