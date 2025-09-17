import { NextRequest, NextResponse } from 'next/server';
import { supabase, TABLES } from '../../../../lib/supabase-backend';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;

    // Handle demo sessions
    if (sessionId.startsWith('demo-')) {
      console.log('🎭 Demo session requested:', sessionId);
      return NextResponse.json({
        session: null,
        isDemo: true,
        message: 'Demo session - using localStorage data'
      });
    }

    // Verify user authentication for real sessions
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
      console.error('❌ Session not found:', sessionError);
      return NextResponse.json(
        { error: 'Session not found' },
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

    console.log('✅ Session found:', session.id, 'Status:', session.status);

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
      analysisMetadata: {
        analysisType: analysisResult?.analysis_type,
        provider: analysisResult?.provider,
        version: analysisResult?.version,
        confidenceScore: analysisResult?.confidence_score,
        processingTimeMs: analysisResult?.processing_time_ms,
        createdAt: analysisResult?.created_at
      },
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
