import { NextRequest, NextResponse } from 'next/server';
import { supabase, TABLES } from '../../../../lib/supabase-backend';
import { type TranscriptMessage } from '../../../../lib/analysis-utils';

function validateEndSession(data: any) {
  if (!data.session_id || typeof data.session_id !== 'string') {
    throw new Error('Invalid session_id');
  }
  if (!data.duration_seconds || typeof data.duration_seconds !== 'number' || data.duration_seconds <= 0) {
    throw new Error('Invalid duration_seconds');
  }
  // Validate transcript if provided
  if (data.transcript && !Array.isArray(data.transcript)) {
    throw new Error('Invalid transcript format - must be array');
  }
  return data;
}

export async function POST(req: NextRequest) {
  try {
    // Parse request body first to check for demo session
    const body = await req.json();
    const validatedData = validateEndSession(body);
    
    // Handle demo sessions
    if (validatedData.session_id.startsWith('demo-')) {
      console.log('🎭 Demo session ending:', validatedData.session_id);
      
      const minutesUsed = Math.ceil(validatedData.duration_seconds / 60);
      const mockScore = Math.round((Math.random() * 2 + 3.5) * 10) / 10; // 3.5-5.5
      
      // Trigger analysis for demo session if transcript provided
      if (validatedData.transcript && validatedData.transcript.length > 0) {
        try {
          console.log('🚀 Triggering analysis for demo session');
          const analysisResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/session/analyze`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sessionId: validatedData.session_id,
              transcript: validatedData.transcript,
              duration: validatedData.duration_seconds,
              userInfo: validatedData.userInfo
            })
          });

          if (analysisResponse.ok) {
            console.log('✅ Demo analysis triggered successfully');
          }
        } catch (analysisError) {
          console.error('⚠️ Demo analysis trigger failed:', analysisError);
          // Don't fail the session end for analysis errors
        }
      }

      // Return mock response for demo
      return NextResponse.json({
        session: {
          id: validatedData.session_id,
          status: 'completed',
          ended_at: new Date().toISOString(),
          duration_seconds: validatedData.duration_seconds,
          minute_cost: 0, // Free for demo
          minutes_used: minutesUsed,
          score: mockScore,
          isDemo: true,
          analysisTriggered: !!(validatedData.transcript && validatedData.transcript.length > 0)
        }
      });
    }
    
    // For real sessions, require authorization
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify the user token with Supabase
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

    // Body already parsed and validated above

    // Get the session and verify ownership
    const { data: session, error: sessionError } = await supabase
      .from(TABLES.SESSIONS)
      .select('*')
      .eq('id', validatedData.session_id)
      .eq('profile_id', profile.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found or access denied' }, { status: 404 });
    }

    if (session.status !== 'active') {
      return NextResponse.json({ error: 'Session is not active' }, { status: 400 });
    }

    // Calculate minute cost based on duration
    const minutesUsed = Math.ceil(validatedData.duration_seconds / 60);
    const minuteCost = minutesUsed * 0.1; // $0.1 per minute (example pricing)

    // Update the session
    const updateData: any = {
      status: 'completed',
      ended_at: new Date().toISOString(),
      duration_seconds: validatedData.duration_seconds,
      audio_quality: validatedData.audio_quality,
      audio_file_url: validatedData.audio_file_url,
      audio_file_size: validatedData.audio_file_size,
      minute_cost: minuteCost,
      processing_status: validatedData.transcript ? 'analyzing' : 'completed'
    };

    // Store transcript if provided
    if (validatedData.transcript) {
      updateData.transcript = validatedData.transcript;
    }

    const { data: updatedSession, error: updateError } = await supabase
      .from(TABLES.SESSIONS)
      .update(updateData)
      .eq('id', validatedData.session_id)
      .select()
      .single();

    if (updateError) {
      console.error('Session update error:', updateError);
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
    }

    // Update subscription usage
    const { data: subscription } = await supabase
      .from(TABLES.SUBSCRIPTIONS)
      .select('*')
      .eq('profile_id', profile.id)
      .eq('status', 'active')
      .single();

    if (subscription) {
      await supabase
        .from(TABLES.SUBSCRIPTIONS)
        .update({ 
          minutes_used: subscription.minutes_used + minutesUsed 
        })
        .eq('id', subscription.id);

      // Record usage
      await supabase.from(TABLES.USAGE).insert({
        profile_id: profile.id,
        company_id: profile.company_id,
        minutes_used: minutesUsed,
        session_id: validatedData.session_id,
        period_start: subscription.current_period_start,
        period_end: subscription.current_period_end
      });
    }

    // Trigger analysis if transcript is provided
    let analysisTriggered = false;
    if (validatedData.transcript && validatedData.transcript.length > 0) {
      try {
        console.log('🚀 Triggering analysis for session:', validatedData.session_id);

        const userInfo = {
          name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
          company: profile.company_id || 'Unknown Company',
          role: profile.position || 'Unknown Role'
        };

        const analysisResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/session/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-server-secret': process.env.SERVER_SECRET!
          },
          body: JSON.stringify({
            sessionId: validatedData.session_id,
            transcript: validatedData.transcript,
            duration: validatedData.duration_seconds,
            userInfo
          })
        });

        if (analysisResponse.ok) {
          console.log('✅ Analysis triggered successfully');
          analysisTriggered = true;
        } else {
          console.error('⚠️ Analysis trigger failed:', analysisResponse.status, analysisResponse.statusText);
        }
      } catch (analysisError) {
        console.error('⚠️ Analysis trigger error:', analysisError);
        // Don't fail the session end for analysis errors
      }
    }

    // Log audit trail
    await supabase.from(TABLES.AUDIT_LOGS).insert({
      user_id: user.id,
      company_id: profile.company_id,
      event_type: 'session',
      resource: 'sessions',
      action: 'complete',
      details: {
        session_id: validatedData.session_id,
        duration_seconds: validatedData.duration_seconds,
        minutes_used: minutesUsed,
        minute_cost: minuteCost,
        transcript_provided: !!(validatedData.transcript && validatedData.transcript.length > 0),
        analysis_triggered: analysisTriggered,
        timestamp: new Date().toISOString()
      }
    });

    return NextResponse.json({
      session: {
        id: updatedSession.id,
        status: updatedSession.status,
        ended_at: updatedSession.ended_at,
        duration_seconds: updatedSession.duration_seconds,
        minute_cost: minuteCost,
        minutes_used: minutesUsed,
        transcript_stored: !!(validatedData.transcript && validatedData.transcript.length > 0),
        analysis_triggered: analysisTriggered,
        processing_status: updatedSession.processing_status
      }
    });

  } catch (error) {
    console.error('Error in end-session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
