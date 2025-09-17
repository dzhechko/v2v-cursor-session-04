import { NextRequest, NextResponse } from 'next/server';
import { supabase, TABLES } from '../../../../lib/supabase-backend';
import { createClient } from '@supabase/supabase-js';
import { isElevenLabsSession } from '../../../../lib/session-utils';

// Fetch session data from ElevenLabs API
async function fetchElevenLabsSession(conversationId: string) {
  const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenlabsApiKey) {
    throw new Error('ElevenLabs API key not configured');
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
    {
      headers: {
        'xi-api-key': elevenlabsApiKey,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs API error: ${response.status}`);
  }

  return await response.json();
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;
    console.log('🔍 Session requested:', sessionId);

    // Handle demo sessions (no authentication required)
    if (sessionId.startsWith('demo-')) {
      console.log('🎭 Demo session requested:', sessionId);
      return NextResponse.json({
        session: null,
        isDemo: true,
        message: 'Demo session - using localStorage data'
      });
    }

    // Handle ElevenLabs sessions (no authentication required)
    // SECURITY NOTE: ElevenLabs sessions (conv_*) are publicly accessible by design.
    // They only require the server-side XI API key for fetching from ElevenLabs API.
    // This is intentional as these sessions may be shared across users for demo/training purposes.
    // Rate limiting should be implemented at the edge/CDN level to prevent abuse.
    if (isElevenLabsSession(sessionId)) {
      console.log('🔗 ElevenLabs session requested:', sessionId);

      // Check if ElevenLabs API key is configured
      if (!process.env.ELEVENLABS_API_KEY) {
        console.error('❌ ElevenLabs API key not configured');
        return NextResponse.json(
          { error: 'ElevenLabs not configured' },
          { status: 503 }
        );
      }

      try {
        const elevenlabsData = await fetchElevenLabsSession(sessionId);

        // Transform ElevenLabs data to match our session format
        const sessionData = {
          id: elevenlabsData.conversation_id,
          title: elevenlabsData.call_summary_title || 'Voice Training Session',
          status: elevenlabsData.status === 'done' ? 'completed' : elevenlabsData.status,
          duration: elevenlabsData.call_duration_secs || 0,
          transcript: elevenlabsData.transcript || [],
          overallScore: null, // ElevenLabs doesn't provide scores
          feedbackSummary: elevenlabsData.transcript_summary || null,
          createdAt: new Date(elevenlabsData.start_time_unix_secs * 1000).toISOString(),
          endedAt: elevenlabsData.end_time_unix_secs ? new Date(elevenlabsData.end_time_unix_secs * 1000).toISOString() : null,
          analyzedAt: null,
          processingStatus: 'completed',
          profile: null,
          detailedAnalysis: null,
          analysisMetadata: null,
          metrics: null,
          isElevenLabs: true
        };

        return NextResponse.json({
          session: sessionData,
          analysis: null,
          metrics: null,
          isDemo: false,
          isElevenLabs: true
        });
      } catch (error) {
        console.error('❌ ElevenLabs session fetch error:', error);
        return NextResponse.json(
          { error: 'ElevenLabs session not found or unavailable' },
          { status: 404 }
        );
      }
    }

    // For database sessions, verify user authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid authorization token' }, { status: 401 });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from(TABLES.PROFILES)
      .select('*')
      .eq('auth_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Get session from database with ownership verification
    const { data: session, error: sessionError } = await supabase
      .from(TABLES.SESSIONS)
      .select(`
        *,
        profile:${TABLES.PROFILES}(
          first_name,
          last_name,
          position
        )
      `)
      .eq('id', sessionId)
      .eq('profile_id', profile.id)
      .single();

    if (sessionError || !session) {
      console.error('❌ Database session not found:', sessionError);
      return NextResponse.json(
        { error: 'Database session not found or access denied' },
        { status: 404 }
      );
    }

    // Get detailed analysis and metrics if available
    const { data: analysisResult } = await supabase
      .from(TABLES.ANALYSIS_RESULTS)
      .select('*')
      .eq('session_id', sessionId)
      .single();

    const { data: sessionMetrics } = await supabase
      .from(TABLES.SESSION_ANALYTICS)
      .select('*')
      .eq('session_id', sessionId)
      .single();

    console.log('✅ Database session found:', session.id, 'Status:', session.status);

    const sessionData = {
      id: session.id,
      title: session.session_type || 'Voice Training Session',
      status: session.status,
      duration: session.duration_seconds || 0,
      transcript: session.transcript,
      overallScore: session.overall_score,
      feedbackSummary: session.feedback_summary,
      createdAt: session.created_at,
      endedAt: session.ended_at,
      analyzedAt: session.analyzed_at,
      processingStatus: session.processing_status,
      profile: session.profile,
      detailedAnalysis: analysisResult?.results || null,
      analysisMetadata: analysisResult ? {
        analysisType: analysisResult.analysis_type,
        provider: analysisResult.provider,
        version: analysisResult.version,
        confidenceScore: analysisResult.confidence_score,
        processingTimeMs: analysisResult.processing_time_ms,
        createdAt: analysisResult.created_at
      } : null,
      metrics: sessionMetrics ? {
        talkTimeRatio: sessionMetrics.talk_time_ratio,
        fillerWordsCount: sessionMetrics.filler_words_count,
        speakingPaceWpm: sessionMetrics.speaking_pace_wpm,
        sentimentScore: sessionMetrics.sentiment_score,
        overallScore: sessionMetrics.overall_score,
        openingScore: sessionMetrics.opening_score,
        questioningScore: sessionMetrics.questioning_score,
        objectionHandlingScore: sessionMetrics.objection_handling_score,
        closingScore: sessionMetrics.closing_score,
        sessionDate: sessionMetrics.session_date,
        sessionHour: sessionMetrics.session_hour
      } : null
    };

    return NextResponse.json({
      session: sessionData,
      analysis: analysisResult?.results || null,
      metrics: sessionData.metrics,
      isDemo: false
    });

  } catch (error) {
    console.error('❌ Error fetching session:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
