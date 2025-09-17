'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { normalizeSessionStatus } from '../../lib/session-utils';
import { 
  Clock, 
  Target, 
  TrendingUp, 
  Calendar,
  Mic,
  Play,
  BarChart3,
  ArrowRight,
  LogOut,
  Settings,
  User,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { createClient } from '../../lib/supabase';
import LogoutButton from '../../components/logout-button';

// Types
interface DashboardStats {
  minutesLeft: number;
  sessionsToday: number;
  progressScore: number;
  streakDays: number;
}

interface RecentSession {
  id: string;
  title: string;
  duration: number;
  minutes?: number;
  score: number;
  date: Date;
  status: 'completed' | 'in_progress' | 'demo' | 'processing' | 'active' | 'analyzed';
  improvement?: number;
  feedback?: string;
  topics?: string[];
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isDemo, setIsDemo] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        
        // Check if user is authenticated
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log('📋 Loading demo dashboard data...');
          setIsDemo(true);
          
          // Load demo sessions from localStorage
          const demoSessions = JSON.parse(localStorage.getItem('demo-sessions') || '[]');
          const formattedDemoSessions: RecentSession[] = demoSessions.map((session: any) => ({
            ...session,
            id: session.id || `demo-${Date.now()}-${Math.random()}`, // Ensure demo sessions have IDs
            date: new Date(session.date),
            minutes: session.duration ? Math.ceil(session.duration / 60) : session.minutes,
            status: 'demo', // Explicitly mark as demo
            feedback: session.feedback || 'Demo session - no analysis available'
          }));
          
          // Calculate demo stats
          const todaySessions = formattedDemoSessions.filter(s => 
            new Date(s.date).toDateString() === new Date().toDateString()
          );
          
          const avgScore = formattedDemoSessions.length > 0 
            ? formattedDemoSessions.reduce((sum, s) => sum + s.score, 0) / formattedDemoSessions.length
            : 0;
          
          setStats({
            minutesLeft: 100 - (formattedDemoSessions.reduce((sum, s) => sum + (s.minutes || 0), 0)),
            sessionsToday: todaySessions.length,
            progressScore: Math.round(avgScore * 10) / 10,
            streakDays: formattedDemoSessions.length > 0 ? 1 : 0
          });
          
          setRecentSessions(formattedDemoSessions);
          
          if (formattedDemoSessions.length > 0) {
            toast.success('🎭 Demo dashboard loaded with your session data!');
          }
        } else {
          console.log('✅ Loading real user dashboard data...');
          setIsDemo(false);
          
          // Get current session for API calls
          const { data: { session } } = await supabase.auth.getSession();
          const authHeaders = session ? {
            'Authorization': `Bearer ${session.access_token}`
          } : undefined;

          // Fetch real stats and sessions in parallel
          const [statsResponse, sessionsResponse] = await Promise.all([
            fetch('/api/dashboard/stats', authHeaders ? { headers: authHeaders } : {}),
            fetch('/api/dashboard/recent-sessions?limit=5', authHeaders ? { headers: authHeaders } : {})
          ]);

          console.log('📊 Dashboard API responses:', {
            stats: statsResponse.status,
            sessions: sessionsResponse.status
          });

          // Log auth headers for debugging
          console.log('🔑 Auth headers sent:', authHeaders ? 'Present' : 'Missing');

          if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            setStats({
              minutesLeft: statsData.minutesLeft || 0,
              sessionsToday: statsData.sessionsToday || 0,
              progressScore: statsData.progressScore || 0,
              streakDays: statsData.streakDays || 0
            });
          }

          if (sessionsResponse.ok) {
            const sessionsData = await sessionsResponse.json();
            console.log('📋 Sessions data received:', sessionsData);
            if (Array.isArray(sessionsData)) {
              const sessions = sessionsData.map((session: any) => {
                // Validate required fields
                if (!session.id) {
                  console.warn('⚠️ Session missing ID:', session);
                  return null;
                }

                return {
                  ...session,
                  date: new Date(session.date),
                  // Use minutes if available, otherwise calculate from duration
                  minutes: session.minutes || (session.duration ? Math.ceil(session.duration / 60) : 0),
                  // Ensure score is a number
                  score: typeof session.score === 'number' ? session.score : 0,
                  // Handle improvement as optional
                  improvement: session.improvement || 0,
                  // Provide defaults for optional fields
                  feedback: session.feedback || 'Analysis pending',
                  topics: session.topics || [],
                  // Normalize status for consistent display
                  status: normalizeSessionStatus(session.status, !!session.feedback)
                };
              }).filter(Boolean); // Remove any invalid sessions

              console.log('📋 Processed sessions:', sessions.length);
              setRecentSessions(sessions);
            } else {
              console.warn('⚠️ Sessions data is not an array:', typeof sessionsData);
              setRecentSessions([]);
            }
          } else {
            console.error('❌ Sessions API failed:', sessionsResponse.status);
            const errorText = await sessionsResponse.text();
            console.error('❌ Sessions API error:', errorText);

            // Retry logic for recoverable errors
            if (sessionsResponse.status >= 500) {
              console.log('🔄 Retrying sessions fetch...');
              setTimeout(() => {
                fetchDashboardData();
              }, 2000);
            } else {
              toast.error('Failed to load sessions. Please try again.');
            }
          }
        }
        
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        
        // Fallback to mock data
        setStats({
          minutesLeft: 150,
          sessionsToday: 0,
          progressScore: 0,
          streakDays: 0
        });
        setRecentSessions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [supabase]);

  // Get user session
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        
        // Get user profile
        const { data: profile } = await supabase
          .from('salesai_profiles')
          .select('*')
          .eq('auth_id', session.user.id)
          .single();
        
        setUserProfile(profile);
      } else {
        // Check for demo user info
        const demoUser = localStorage.getItem('demo-user');
        if (demoUser) {
          const userData = JSON.parse(demoUser);
          setUserProfile({ 
            first_name: userData.name?.split(' ')[0] || 'Demo',
            full_name: userData.name || 'Demo User',
            company_name: userData.company || 'Demo Company'
          });
        }
      }
    };

    getUser();
  }, [supabase]);

  // Group sessions by date
  const groupedSessions = (recentSessions || []).reduce((groups, session) => {
    const date = session.date.toDateString();
    if (!groups[date]) groups[date] = [];
    groups[date].push(session);
    return groups;
  }, {} as Record<string, RecentSession[]>);

  const getDateLabel = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    
    if (dateString === today) return 'TODAY';
    if (dateString === yesterday) return 'YESTERDAY';
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  // Use fallback stats if not loaded
  const displayStats = stats || {
    minutesLeft: 150,
    sessionsToday: 0,
    progressScore: 0,
    streakDays: 0
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white shadow-sm border-b"
      >
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-4 mb-2">
                <Link href="/" className="text-blue-600 hover:text-blue-800 flex items-center text-sm">
                  ← Back to Home
                </Link>
                {isDemo && (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                    DEMO MODE
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome back{userProfile ? `, ${userProfile.first_name}` : ''}!
              </h1>
              <p className="text-gray-600">
                {isDemo 
                  ? 'Demo dashboard showing your session analytics' 
                  : 'Ready to improve your sales skills?'
                }
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Settings Link */}
              <Link 
                href="/settings"
                className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Settings"
              >
                <Settings className="w-4 h-4 mr-2" />
                <span className="text-sm">Settings</span>
              </Link>
              
              {/* Logout Button */}
              <LogoutButton variant="full" />
              
              {/* User Avatar */}
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {userProfile ? userProfile.first_name?.[0]?.toUpperCase() || 'U' : 'DU'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Quick Stats Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <motion.div variants={itemVariants} className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-6 h-6 text-blue-600" />
              {isLoading ? (
                <div className="animate-pulse bg-gray-200 h-8 w-12 rounded"></div>
              ) : (
                <span className="text-2xl font-bold text-gray-900">{displayStats.minutesLeft}</span>
              )}
            </div>
            <p className="text-sm text-gray-600">Minutes Left</p>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <Target className="w-6 h-6 text-green-600" />
              {isLoading ? (
                <div className="animate-pulse bg-gray-200 h-8 w-8 rounded"></div>
              ) : (
                <span className="text-2xl font-bold text-gray-900">{displayStats.sessionsToday}</span>
              )}
            </div>
            <p className="text-sm text-gray-600">Today</p>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-6 h-6 text-purple-600" />
              {isLoading ? (
                <div className="animate-pulse bg-gray-200 h-8 w-12 rounded"></div>
              ) : (
                <span className="text-2xl font-bold text-gray-900">{displayStats.progressScore}</span>
              )}
            </div>
            <p className="text-sm text-gray-600">Avg Score</p>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <Calendar className="w-6 h-6 text-orange-600" />
              {isLoading ? (
                <div className="animate-pulse bg-gray-200 h-8 w-8 rounded"></div>
              ) : (
                <span className="text-2xl font-bold text-gray-900">{displayStats.streakDays}</span>
              )}
            </div>
            <p className="text-sm text-gray-600">Day Streak</p>
          </motion.div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8"
        >
          <motion.div variants={itemVariants}>
            <Link href="/session" className="block">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Start Training Session</h3>
                    <p className="text-blue-100 text-sm">Practice with AI-powered voice coaching</p>
                  </div>
                  <div className="bg-white/20 rounded-full p-3">
                    <Play className="w-6 h-6" />
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Link href="/session?type=custom" className="block">
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl p-6 text-white hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Custom Practice</h3>
                    <p className="text-purple-100 text-sm">Create your own training scenario</p>
                  </div>
                  <div className="bg-white/20 rounded-full p-3">
                    <Settings className="w-6 h-6" />
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="bg-white rounded-xl shadow-lg"
        >
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
              <BarChart3 className="w-5 h-5 text-gray-400" />
            </div>
          </div>

          <div className="p-6">
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                      <div className="h-6 bg-gray-200 rounded w-12"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : Object.keys(groupedSessions).length === 0 ? (
              <div className="text-center py-8">
                <Mic className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-medium">No sessions yet</p>
                <p className="text-gray-400 text-sm mt-1">
                  {isDemo 
                    ? 'Complete a demo session to see analytics here'
                    : 'Start your first training session to see your progress here'
                  }
                </p>
                <Link href="/session" className="inline-flex items-center mt-4 text-blue-600 hover:text-blue-800 font-medium">
                  Start Training <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedSessions)
                  .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                  .map(([date, sessions]) => (
                    <div key={date}>
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                        {getDateLabel(date)}
                      </h3>
                      <div className="space-y-3">
                        {sessions.map((session) => (
                          <motion.div
                            key={session.id}
                            variants={itemVariants}
                            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                            onClick={() => {
                              // Handle demo sessions
                              if (session.status === 'demo' || session.id?.startsWith('demo-')) {
                                toast.success('Demo session analytics loaded!');
                                return;
                              }

                              // Handle database sessions
                              if (session.id) {
                                console.log('🔗 Navigating to session results:', session.id);
                                router.push(`/session/${session.id}/results`);
                              } else {
                                console.error('❌ Session missing ID:', session);
                                toast.error('Unable to load session results');
                              }
                            }}
                          >
                            <div className="flex items-center space-x-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                session.status === 'completed' || session.status === 'analyzed' ? 'bg-green-100 text-green-600' :
                                session.status === 'demo' ? 'bg-blue-100 text-blue-600' :
                                session.status === 'active' ? 'bg-yellow-100 text-yellow-600' :
                                session.status === 'processing' ? 'bg-purple-100 text-purple-600' :
                                'bg-orange-100 text-orange-600'
                              }`}>
                                <Mic className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{session.title}</p>
                                <div className="flex items-center space-x-4 text-sm text-gray-500">
                                  <span>{session.minutes || (session.duration ? Math.ceil(session.duration / 60) : 0)} min</span>
                                  {session.score > 0 && (
                                    <span className="flex items-center">
                                      <span className="text-yellow-500 mr-1">★</span>
                                      {session.score.toFixed(1)}
                                    </span>
                                  )}
                                  {session.improvement && session.improvement > 0 && (
                                    <span className="text-green-600 flex items-center">
                                      <TrendingUp className="w-3 h-3 mr-1" />
                                      +{session.improvement.toFixed(1)}
                                    </span>
                                  )}
                                  {session.status === 'demo' && (
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                      DEMO
                                    </span>
                                  )}
                                </div>
                                {session.feedback && (
                                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                    {session.feedback}
                                  </p>
                                )}
                              </div>
                            </div>
                            <ArrowRight className="w-5 h-5 text-gray-400" />
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        </motion.div>

        {/* Demo mode notice */}
        {isDemo && recentSessions.length > 0 && (
          <motion.div
            variants={itemVariants}
            className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4"
          >
            <div className="flex">
              <div className="flex-shrink-0">
                <BarChart3 className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Demo Analytics</h3>
                <p className="mt-1 text-sm text-blue-700">
                  This dashboard shows analytics from your demo session. 
                  <Link href="/register" className="underline ml-1">
                    Sign up for real-time analytics
                  </Link> and detailed feedback.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
