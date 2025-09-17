'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Award,
  FileText,
  Printer,
  Loader,
  Clock,
  MessageSquare,
  TrendingUp,
  Mic,
  BarChart3
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { createClient } from '../../../lib/supabase';

interface AnalysisData {
  overallScore: number;
  title: string;
  strengths: string[];
  areasForImprovement: string[];
  effectiveTechniques: string[];
  techniquesNeedingWork: string[];
  objectionHandling: {
    score: number;
    analysis: string;
  };
  closingEffectiveness: {
    score: number;
    analysis: string;
  };
  keyRecommendations: string[];
  detailedAnalysis: string;
  duration?: number;
  date?: string;
}

interface SessionMetrics {
  talkTimeRatio: number;
  fillerWordsCount: number;
  speakingPaceWpm: number;
  sentimentScore: number;
  overallScore?: number;
  openingScore?: number;
  questioningScore?: number;
  objectionHandlingScore?: number;
  closingScore?: number;
}

interface SessionData {
  id: string;
  title: string;
  status: string;
  duration: number;
  transcript: any[];
  overallScore?: number;
  feedbackSummary?: string;
  createdAt: string;
  endedAt?: string;
  analyzedAt?: string;
  processingStatus: string;
  profile?: any;
  detailedAnalysis?: AnalysisData;
  metrics?: SessionMetrics;
}

export default function SessionResultsPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    const loadSessionData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log('🔍 Loading session analysis:', sessionId);

        // Handle demo sessions with localStorage
        if (sessionId.startsWith('demo-') || sessionId.startsWith('temp-')) {
          console.log('🎭 Demo session - loading from localStorage');
          setIsDemo(true);

          // Load demo data from localStorage or use mock data
          const demoAnalysis = localStorage.getItem(`analysis-${sessionId}`);
          const demoDuration = localStorage.getItem(`session-duration-${sessionId}`);

          if (demoAnalysis) {
            const parsedAnalysis = JSON.parse(demoAnalysis);
            setSessionData({
              id: sessionId,
              title: parsedAnalysis.title || 'Demo Voice Training Session',
              status: 'analyzed',
              duration: parseInt(demoDuration || '300'),
              transcript: [],
              overallScore: parsedAnalysis.overallScore,
              feedbackSummary: parsedAnalysis.detailedAnalysis?.substring(0, 200) + '...',
              createdAt: new Date().toISOString(),
              endedAt: new Date().toISOString(),
              analyzedAt: new Date().toISOString(),
              processingStatus: 'completed',
              detailedAnalysis: parsedAnalysis,
              metrics: {
                talkTimeRatio: 0.65,
                fillerWordsCount: 8,
                speakingPaceWpm: 145,
                sentimentScore: 0.72,
                overallScore: Math.round(parsedAnalysis.overallScore * 10)
              }
            });
            setIsLoading(false);
            return;
          }
        }

        // For real sessions, fetch from our API
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const response = await fetch(`/api/session/${sessionId}`, {
          headers: {
            ...(token && { 'Authorization': `Bearer ${token}` }),
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const result = await response.json();
          if (result.isDemo) {
            setIsDemo(true);
            setError('This is a demo session. Analysis data is stored locally.');
          } else {
            setSessionData(result.session);
            console.log('✅ Session data loaded successfully');
          }
        } else {
          const errorData = await response.json();
          setError(`Failed to load session: ${errorData.error || 'Unknown error'}`);
        }

      } catch (error) {
        console.error('❌ Error loading session data:', error);
        setError('Failed to load session analysis. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    if (sessionId) {
      loadSessionData();
    }
  }, [sessionId]);

  const handleExportReport = () => {
    if (!sessionData) return;

    const reportData = {
      session: sessionData,
      exportedAt: new Date().toISOString(),
      isDemo
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-analysis-${sessionId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Loading Analysis...</h2>
          <p className="text-gray-500">Fetching your session results</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Analysis Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-x-4">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Try Again
            </button>
            <Link href="/session" className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
              Start New Session
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No Analysis Available</h2>
          <p className="text-gray-600 mb-6">Could not load session analysis data.</p>
          <Link href="/session" className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
            Start New Session
          </Link>
        </div>
      </div>
    );
  }

  const analysis = sessionData.detailedAnalysis;
  const metrics = sessionData.metrics;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/session" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {sessionData.title}
                  {isDemo && <span className="ml-2 text-sm bg-blue-100 text-blue-600 px-2 py-1 rounded">Demo</span>}
                </h1>
                <p className="text-sm text-gray-500">
                  Voice Training Session • {new Date(sessionData.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <button
              onClick={handleExportReport}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Export Report</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-lg shadow-sm border"
          >
            <div className="flex items-center space-x-3 mb-2">
              <Award className="w-5 h-5 text-green-500" />
              <h3 className="font-semibold text-gray-900">Overall Score</h3>
            </div>
            <p className="text-3xl font-bold text-green-500">
              {analysis ? `${analysis.overallScore}/10` : `${sessionData.overallScore || 0}/100`}
            </p>
            <p className="text-sm text-gray-500 mt-1">AI-powered evaluation</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-6 rounded-lg shadow-sm border"
          >
            <div className="flex items-center space-x-3 mb-2">
              <Clock className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold text-gray-900">Duration</h3>
            </div>
            <p className="text-3xl font-bold text-blue-500">{Math.ceil(sessionData.duration / 60)}m</p>
            <p className="text-sm text-gray-500 mt-1">{sessionData.duration} seconds total</p>
          </motion.div>

          {metrics && (
            <>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white p-6 rounded-lg shadow-sm border"
              >
                <div className="flex items-center space-x-3 mb-2">
                  <Mic className="w-5 h-5 text-purple-500" />
                  <h3 className="font-semibold text-gray-900">Talk Time</h3>
                </div>
                <p className="text-3xl font-bold text-purple-500">{Math.round(metrics.talkTimeRatio * 100)}%</p>
                <p className="text-sm text-gray-500 mt-1">of conversation</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white p-6 rounded-lg shadow-sm border"
              >
                <div className="flex items-center space-x-3 mb-2">
                  <TrendingUp className="w-5 h-5 text-orange-500" />
                  <h3 className="font-semibold text-gray-900">Speaking Pace</h3>
                </div>
                <p className="text-3xl font-bold text-orange-500">{metrics.speakingPaceWpm}</p>
                <p className="text-sm text-gray-500 mt-1">words per minute</p>
              </motion.div>
            </>
          )}
        </div>

        {/* Additional Metrics */}
        {metrics && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white p-6 rounded-lg shadow-sm border mb-8"
          >
            <div className="flex items-center space-x-3 mb-4">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-semibold text-gray-900">Communication Metrics</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Filler Words</h3>
                <p className="text-2xl font-bold text-gray-700">{metrics.fillerWordsCount}</p>
                <p className="text-sm text-gray-500">instances detected</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Sentiment Score</h3>
                <p className="text-2xl font-bold text-gray-700">{Math.round(metrics.sentimentScore * 100)}%</p>
                <p className="text-sm text-gray-500">positive sentiment</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Status</h3>
                <p className="text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    sessionData.status === 'analyzed'
                      ? 'bg-green-100 text-green-600'
                      : 'bg-yellow-100 text-yellow-600'
                  }`}>
                    {sessionData.status === 'analyzed' ? '✅ Analyzed' : '⏳ Processing'}
                  </span>
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Analysis Results */}
        {analysis && (
          <>
            {/* Detailed Analysis */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white p-6 rounded-lg shadow-sm border mb-8"
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Detailed Analysis</h2>
              <p className="text-gray-700 leading-relaxed">{analysis.detailedAnalysis}</p>
            </motion.div>

            {/* Key Strengths & Areas for Improvement */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-white p-6 rounded-lg shadow-sm border"
              >
                <div className="flex items-center space-x-3 mb-4">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <h2 className="text-lg font-semibold text-gray-900">Strengths</h2>
                </div>
                <ul className="space-y-2">
                  {analysis.strengths.map((strength, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0"></span>
                      <span className="text-gray-700">{strength}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="bg-white p-6 rounded-lg shadow-sm border"
              >
                <div className="flex items-center space-x-3 mb-4">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <h2 className="text-lg font-semibold text-gray-900">Areas for Improvement</h2>
                </div>
                <ul className="space-y-2">
                  {analysis.areasForImprovement.map((area, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0"></span>
                      <span className="text-gray-700">{area}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>

            {/* Skill Scores */}
            {analysis.objectionHandling && analysis.closingEffectiveness && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="bg-white p-6 rounded-lg shadow-sm border mb-8"
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Skill Assessment</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">
                      Objection Handling ({analysis.objectionHandling.score}/10)
                    </h3>
                    <p className="text-gray-700 text-sm">{analysis.objectionHandling.analysis}</p>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">
                      Closing Effectiveness ({analysis.closingEffectiveness.score}/10)
                    </h3>
                    <p className="text-gray-700 text-sm">{analysis.closingEffectiveness.analysis}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Recommended Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="bg-white p-6 rounded-lg shadow-sm border mb-8"
            >
              <div className="flex items-center space-x-3 mb-4">
                <FileText className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold text-gray-900">Key Recommendations</h2>
              </div>
              <ul className="space-y-3">
                {analysis.keyRecommendations.map((action, index) => (
                  <li key={index} className="flex items-start space-x-3">
                    <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded-full text-xs font-medium mt-0.5">
                      {index + 1}
                    </span>
                    <span className="text-gray-700">{action}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/session"
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-center"
          >
            Start New Session
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-center"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}