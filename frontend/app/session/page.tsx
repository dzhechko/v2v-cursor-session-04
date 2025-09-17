'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import VoiceSessionInterface from '../../components/voice-session/voice-session-interface';
import { toast } from 'react-hot-toast';
import { createClient } from '../../lib/supabase';
import { type TranscriptMessage } from '../../lib/analysis-utils';

export default function SessionPage() {
  console.log('📟 SessionPage - Enhanced Analysis Architecture!');

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(true);
  const [userInfo, setUserInfo] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();

  // Comment 1: Create a stable demo session ID with immediate initial value
  const demoSessionIdRef = useRef<string>(`demo-${Date.now()}`);

  console.log('📟 SessionPage current state:', {
    sessionId,
    isReady,
    userInfo: !!userInfo,
    demoSessionId: demoSessionIdRef.current
  });

  // Check user authentication
  useEffect(() => {
    const checkUserAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔍 Auth check:', session ? `Logged in as ${session.user?.email}` : 'Not logged in');
      
      if (!session) {
        // Check for personalized demo data from demo-request page
        const demoUserData = localStorage.getItem('demo-user');
        if (demoUserData) {
          const userData = JSON.parse(demoUserData);
          setUserInfo(userData);
          console.log('📋 Personalized demo for:', userData.name, 'from', userData.company);
        } else {
          // No auth and no demo data, redirect to demo request
          toast.error('Please login or fill out demo request to continue');
          router.push('/demo-request');
          return;
        }
      } else {
        // Get user profile information
        try {
          const { data: profile } = await supabase
            .from('salesai_profiles')
            .select('*')
            .eq('auth_id', session.user.id)
            .single();
          
          if (profile) {
            setUserInfo(profile);
            console.log('👤 User profile loaded:', profile.first_name, profile.last_name);
          }
        } catch (error) {
          console.warn('⚠️ Could not load user profile:', error);
        }
      }
    };

    checkUserAuth();
  }, []);

  // Helper function to save demo session to consolidated storage for dashboard
  const saveDemoSessionToStorage = (sessionData: any, analysisData?: any) => {
    try {
      // Get existing demo sessions
      const existingDemoSessions = JSON.parse(localStorage.getItem('demo-sessions') || '[]');

      // Create formatted session for dashboard
      const timestamp = new Date();
      const formattedSession = {
        id: sessionData.id,
        title: sessionData.title || `Demo Session - ${timestamp.toLocaleTimeString()}`,
        duration: sessionData.duration,
        minutes: Math.ceil(sessionData.duration / 60),
        score: analysisData?.overallScore ? analysisData.overallScore / 10 : 7.5, // Convert 0-100 to 0-10 scale
        date: timestamp.toISOString(),
        status: 'demo',
        improvement: 0, // Comment 6: Use deterministic placeholder instead of random
        feedback: analysisData?.summary || analysisData?.detailedAnalysis?.substring(0, 200) || 'Demo session completed successfully',
        topics: ['Voice Training', 'Sales Conversation']
      };

      // Add to existing sessions (keep only last 10)
      const updatedSessions = [formattedSession, ...existingDemoSessions]
        .filter((session, index, self) =>
          index === self.findIndex(s => s.id === session.id)
        ) // Remove duplicates
        .slice(0, 10);

      // Save back to localStorage
      localStorage.setItem('demo-sessions', JSON.stringify(updatedSessions));
      console.log('✅ Demo session saved to consolidated storage');
    } catch (error) {
      console.error('❌ Error saving demo session to storage:', error);
    }
  };

  // Handle session end with enhanced analysis integration
  const handleSessionEnd = async (duration: number, transcript?: TranscriptMessage[]) => {
    // Comment 1: Use stable demo session ID without fallback
    const currentSessionId = sessionId || demoSessionIdRef.current;
    console.log('🏁 Enhanced session ended:', {
      sessionId: currentSessionId,
      duration,
      messageCount: transcript?.length || 0
    });

    try {
      // Convert transcript to our analysis format
      const formattedTranscript = transcript?.map((msg, index) => ({
        speaker: msg.speaker === 'ai' ? 'client' : 'user',
        message: msg.content,
        timestamp: msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now() + index
      })) || [];

      console.log('📝 Formatted transcript for analysis:', formattedTranscript);

      // Comment 5: API contract documentation - uses snake_case fields
      // Prepare session end data with snake_case fields as expected by the API
      const sessionEndData = {
        session_id: currentSessionId,
        duration_seconds: duration,
        transcript: formattedTranscript,
        audio_quality: { connectionQuality: 'good' },
        userInfo: userInfo ? {
          name: `${userInfo.first_name || ''} ${userInfo.last_name || ''}`.trim() || userInfo.name,
          company: userInfo.company || 'Demo Company',
          role: userInfo.position || userInfo.role || 'Sales Representative'
        } : null
      };

      // Call session end API with transcript data
      const saveResponse = await fetch('/api/session/end', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userInfo?.auth_id && { 'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` })
        },
        body: JSON.stringify(sessionEndData)
      });

      if (saveResponse.ok) {
        const sessionData = await saveResponse.json();
        console.log('✅ Session saved with analysis trigger:', sessionData);

        if (sessionData.session?.analysis_triggered) {
          toast.success(`🎉 Session completed! Analysis in progress... Duration: ${Math.round(duration/60)} minutes`);
        } else {
          toast.success(`🎉 Session completed! Duration: ${Math.round(duration/60)} minutes`);
        }

        // Comment 4: Store demo sessions even without transcript
        // Store demo analysis locally if it's a demo session
        if (currentSessionId.startsWith('demo-') && duration > 0) {
          // Validate demo session data
          if (!currentSessionId || typeof duration !== 'number' || duration <= 0) {
            console.warn('⚠️ Invalid demo session data');
            return;
          }

          const demoSessionData = {
            id: currentSessionId,
            title: `Demo Session - ${new Date().toLocaleTimeString()}`,
            duration,
            transcript: formattedTranscript,
            createdAt: new Date().toISOString()
          };

          // Store individual session data for backward compatibility
          localStorage.setItem(`session-${currentSessionId}`, JSON.stringify(demoSessionData));
          localStorage.setItem(`session-duration-${currentSessionId}`, duration.toString());

          // Save to consolidated storage for dashboard
          saveDemoSessionToStorage(demoSessionData);

          // Call analyze API to get demo analysis and store it in localStorage
          try {
            const analysisResponse = await fetch('/api/session/analyze', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                sessionId: currentSessionId,
                transcript: formattedTranscript,
                duration,
                userInfo: userInfo ? {
                  name: `${userInfo.first_name || ''} ${userInfo.last_name || ''}`.trim() || userInfo.name,
                  company: userInfo.company || 'Demo Company',
                  role: userInfo.position || userInfo.role || 'Sales Representative'
                } : null
              })
            });

            if (analysisResponse.ok) {
              const analysisData = await analysisResponse.json();
              // Store the analysis in localStorage for the results page
              localStorage.setItem(`analysis-${currentSessionId}`, JSON.stringify(analysisData.analysis));
              console.log('✅ Demo analysis saved to localStorage');

              // Update consolidated storage with analysis data
              const sessionData = JSON.parse(localStorage.getItem(`session-${currentSessionId}`) || '{}');
              saveDemoSessionToStorage(sessionData, analysisData.analysis);

              // Comment 1: Fix score scale in toast (convert 0-100 to 0-10 if needed)
              // Show toast with analysis feedback
              if (analysisData.analysis?.overallScore !== undefined) {
                const scoreValue = analysisData.analysis.overallScore;
                const displayScore = scoreValue > 10 ? Math.round(scoreValue / 10) : Math.round(scoreValue);
                toast.success(`Analysis complete! Score: ${displayScore}/10`);
              }
            } else {
              console.warn('⚠️ Failed to generate demo analysis');
              // Still save session without analysis
              const sessionData = JSON.parse(localStorage.getItem(`session-${currentSessionId}`) || '{}');
              saveDemoSessionToStorage(sessionData);
            }
          } catch (analysisError) {
            console.error('❌ Error generating demo analysis:', analysisError);
            // Still save session without analysis
            try {
              const sessionData = JSON.parse(localStorage.getItem(`session-${currentSessionId}`) || '{}');
              saveDemoSessionToStorage(sessionData);
            } catch (storageError) {
              console.error('❌ Error saving demo session:', storageError);
            }
          }
        }
      } else {
        const errorData = await saveResponse.json();
        console.warn('⚠️ Could not save session record:', errorData);
        toast.success('🎉 Session completed!');
      }
      
      // Redirect to results page with our session ID
      setTimeout(() => {
        router.push(`/session/${currentSessionId}/results`);
      }, 1500);
       
     } catch (error) {
       console.error('❌ Error handling session end:', error);
       toast.error('Session completed but there was an issue saving data');
       setTimeout(() => {
         router.push('/dashboard');
       }, 2000);
     }
   };

   // Comment 1: Use stable session ID without render-time fallback
   const currentSessionId = sessionId || demoSessionIdRef.current;

   // Initialize session ID on component mount
   useEffect(() => {
     const initializeSession = async () => {
       if (!sessionId && userInfo) {
         // For authenticated users, create session on the server
         if (userInfo.auth_id) {
           try {
             const { data: { session } } = await supabase.auth.getSession();
             const response = await fetch('/api/session/create', {
               method: 'POST',
               headers: {
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${session?.access_token}`
               },
               body: JSON.stringify({
                 title: 'Voice Training Session',
                 userId: userInfo.auth_id
               })
             });

             if (response.ok) {
               const result = await response.json();
               setSessionId(result.session.id);
               console.log('🆔 Server-generated session ID:', result.session.id);
             } else {
               console.error('⚠️ Failed to create server session');
               toast.error('Failed to create session. Please try again or switch to demo mode.');
               setIsReady(false);
               return;
             }
           } catch (error) {
             console.error('❌ Error creating server session:', error);
             toast.error('Failed to create session. Please try again or switch to demo mode.');
             setIsReady(false);
             return;
           }
         } else {
           // Comment 1: For demo users, rely solely on demoSessionIdRef - do not set sessionId
           console.log('🆔 Using stable demo session ID from ref:', demoSessionIdRef.current);
           // Do NOT set sessionId for demo users - use demoSessionIdRef.current throughout
         }
       }
     };

     initializeSession();
   }, [userInfo, sessionId, supabase]);

   return (
     <VoiceSessionInterface
       sessionId={currentSessionId}
       onSessionEnd={handleSessionEnd}
     />
   );
}
