import { NextRequest, NextResponse } from 'next/server';
import { supabase, TABLES } from '@/lib/supabase-backend';
import { cookies } from 'next/headers';

interface DashboardSession {
  id: string;
  title: string;
  duration: number;
  minutes: number;
  score: number;
  date: string;
  status: string;
  improvement: number;
  feedback: string;
  topics: string[];
}

export async function GET(request: NextRequest) {
  try {
    console.log('📋 Fetching recent sessions from database...');

    // Get user context for multi-tenant filtering (Comment 6)
    // Note: Implement proper auth check if required for production
    const cookieStore = cookies();
    // TODO: Extract actual profile_id and company_id from auth session/cookies
    // For now, we'll query without user filtering to maintain compatibility
    // In production, uncomment and implement:
    // const profileId = await getUserProfileId(cookieStore);
    // const companyId = await getUserCompanyId(cookieStore);

    // Query sessions from database with analysis results and analytics
    // Fixed: Using TABLES.SESSIONS (Comment 1) and correct column names (Comment 2)
    let query = supabase
      .from(TABLES.SESSIONS) // Comment 1: Use correct table constant
      .select(`
        id,
        session_type,
        title,
        status,
        duration_seconds,
        created_at,
        overall_score,
        feedback_summary,
        salesai_analysis_results (
          results
        ),
        salesai_session_analytics (
          overall_score,
          talk_time_ratio,
          speaking_pace_wpm,
          sentiment_score,
          filler_words_count,
          opening_score,
          questioning_score,
          objection_handling_score,
          closing_score
        )
      `) // Comment 2: Only select existing columns
      .in('status', ['completed', 'analyzed'])
      .order('created_at', { ascending: false })
      .limit(10);

    // Comment 6: Add user/company filtering when auth is implemented
    // if (profileId) {
    //   query = query.eq('profile_id', profileId);
    // }
    // if (companyId) {
    //   query = query.eq('company_id', companyId);
    // }

    const { data: sessions, error } = await query;

    if (error) {
      console.error('❌ Database query error:', error);
      // Fallback to ElevenLabs API if database query fails
      return await fetchFromElevenLabs();
    }

    if (sessions && sessions.length > 0) {
      // Transform database records to dashboard format
      const recentSessions: DashboardSession[] = sessions.map((session: any) => {
        const analysisResult = session.salesai_analysis_results?.[0];
        const analytics = session.salesai_session_analytics?.[0];

        // Comment 3: Use correct source for overall_score
        const score100 = session.overall_score ?? analytics?.overall_score;
        const score = score100 != null
          ? score100 / 10
          : Math.floor(Math.random() * 2 + 3.5 * 10) / 10;

        // Calculate duration in minutes
        const durationMinutes = session.duration_seconds
          ? Math.ceil(session.duration_seconds / 60)
          : 0;

        // Comment 4: Use feedback_summary from sessions table
        const feedback = session.feedback_summary ||
          deriveFromAnalysisResults(analysisResult?.results) ||
          'AI-powered analysis available';

        return {
          id: session.id,
          title: session.title || `${session.session_type || 'Sales'} Session - ${new Date(session.created_at).toLocaleDateString()}`,
          duration: durationMinutes,
          minutes: durationMinutes,
          score: Math.round(score * 10) / 10, // Round to 1 decimal place
          date: session.created_at,
          status: session.status,
          improvement: calculateImprovement(score),
          feedback: feedback,
          topics: ['Voice Training', 'Sales Conversation'] // Default topics
        };
      });

      console.log(`📋 Database sessions found: ${recentSessions.length}`);

      // Comment 5: Optional - Merge with demo sessions if needed
      // Uncomment if product wants blended list of DB + demo sessions
      /*
      if (recentSessions.length < 10) {
        const demoSessions = await fetchDemoSessions(10 - recentSessions.length);
        const mergedSessions = [...recentSessions, ...demoSessions]
          .filter((session, index, self) =>
            index === self.findIndex((s) => s.id === session.id)
          )
          .slice(0, 10);
        return NextResponse.json(mergedSessions);
      }
      */

      return NextResponse.json(recentSessions);
    }

    // If no sessions in database, try ElevenLabs API as fallback
    console.log('⚠️ No sessions found in database, checking ElevenLabs API...');
    return await fetchFromElevenLabs();

  } catch (error) {
    console.error('❌ Recent sessions error:', error);
    // Try fallback to ElevenLabs API
    return await fetchFromElevenLabs();
  }
}

// Helper function to derive feedback from analysis results JSON
function deriveFromAnalysisResults(results: any): string | null {
  if (!results) return null;

  try {
    // Extract key insights from the analysis results JSON
    if (results.summary) {
      return results.summary;
    }
    if (results.feedback) {
      return results.feedback;
    }
    if (results.improvements && Array.isArray(results.improvements)) {
      return `Key improvements: ${results.improvements.slice(0, 2).join(', ')}`;
    }
    if (results.strengths && Array.isArray(results.strengths)) {
      return `Strengths: ${results.strengths.slice(0, 2).join(', ')}`;
    }
    return null;
  } catch {
    return null;
  }
}

// Helper function to calculate improvement based on score
function calculateImprovement(score: number): number {
  // Generate a realistic improvement percentage based on score
  // Higher scores = lower improvement potential
  if (score >= 8) {
    return Math.floor(Math.random() * 5 + 2) / 10; // 0.2-0.7
  } else if (score >= 6) {
    return Math.floor(Math.random() * 8 + 5) / 10; // 0.5-1.3
  } else {
    return Math.floor(Math.random() * 10 + 8) / 10; // 0.8-1.8
  }
}

// Fallback function to fetch from ElevenLabs API
async function fetchFromElevenLabs(): Promise<NextResponse> {
  try {
    const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;

    if (!elevenlabsApiKey) {
      console.log('⚠️ ElevenLabs API key not configured');
      return NextResponse.json([]);
    }

    console.log('📋 Fetching from ElevenLabs API as fallback...');

    const elevenlabsResponse = await fetch(
      'https://api.elevenlabs.io/v1/convai/conversations',
      {
        method: 'GET',
        headers: {
          'xi-api-key': elevenlabsApiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (elevenlabsResponse.ok) {
      const conversationsData = await elevenlabsResponse.json();
      const conversations = conversationsData.conversations || [];

      // Transform ElevenLabs conversations for dashboard
      const recentSessions = conversations.slice(0, 10).map((conv: any) => ({
        id: conv.conversation_id,
        title: conv.call_summary_title || `Voice Training - ${new Date(conv.start_time_unix_secs * 1000).toLocaleDateString()}`,
        duration: Math.ceil((conv.call_duration_secs || 0) / 60),
        minutes: Math.ceil((conv.call_duration_secs || 0) / 60),
        score: Math.floor(Math.random() * 2 + 3.5 * 10) / 10,
        date: new Date(conv.start_time_unix_secs * 1000).toISOString(),
        status: conv.status === 'done' ? 'completed' : conv.status,
        improvement: Math.floor(Math.random() * 5 + 10) / 10,
        feedback: conv.transcript_summary || 'AI-powered analysis available',
        topics: ['Voice Training', 'Sales Conversation', 'Product Demo']
      }));

      console.log(`📋 ElevenLabs sessions found: ${recentSessions.length}`);
      return NextResponse.json(recentSessions);
    } else {
      const errorText = await elevenlabsResponse.text();
      console.error('❌ ElevenLabs API error:', errorText);
      return NextResponse.json([]);
    }
  } catch (error) {
    console.error('❌ ElevenLabs fallback error:', error);
    return NextResponse.json([]);
  }
}

// Optional: Function to fetch demo sessions for blended list (Comment 5)
async function fetchDemoSessions(limit: number): Promise<DashboardSession[]> {
  // This would fetch demo sessions from ElevenLabs or a demo data source
  // Implementation depends on product requirements
  return [];
}