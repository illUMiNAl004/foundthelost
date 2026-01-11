/**
 * ReportSelector Component
 * Landing page for choosing between reporting a lost or found item
 */

import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../Common/Card';

const ReportSelector = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 pt-16 pb-20 md:pb-8 flex items-center justify-center">
      <div className="max-w-lg mx-auto px-4 py-8 w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Report an Item</h1>
          <p className="text-slate-400">What would you like to report?</p>
        </div>

        {/* Options */}
        <div className="space-y-4">
          {/* Found Item */}
          <button
            onClick={() => navigate('/report/found')}
            className="w-full text-left group"
          >
            <Card className="border-emerald-500/30 hover:border-emerald-500/60 transition-all group-hover:scale-[1.02]">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-emerald-400 mb-1 group-hover:text-emerald-300 transition-colors">
                      I Found Something
                    </h2>
                    <p className="text-slate-400">
                      Report an item you found to help return it to its owner
                    </p>
                    <div className="flex items-center gap-2 mt-3 text-emerald-400/80">
                      <span className="text-sm font-medium">Earn karma points</span>
                      <span className="px-2 py-0.5 bg-emerald-500/20 rounded-full text-xs">+25 karma</span>
                    </div>
                  </div>
                  <svg className="w-6 h-6 text-slate-500 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </CardContent>
            </Card>
          </button>

          {/* Lost Item */}
          <button
            onClick={() => navigate('/report/lost')}
            className="w-full text-left group"
          >
            <Card className="border-red-500/30 hover:border-red-500/60 transition-all group-hover:scale-[1.02]">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-red-400 mb-1 group-hover:text-red-300 transition-colors">
                      I Lost Something
                    </h2>
                    <p className="text-slate-400">
                      Report a lost item and we'll help you find it
                    </p>
                    <div className="flex items-center gap-2 mt-3 text-red-400/80">
                      <span className="text-sm font-medium">AI-powered matching</span>
                      <span className="px-2 py-0.5 bg-red-500/20 rounded-full text-xs">Real-time alerts</span>
                    </div>
                  </div>
                  <svg className="w-6 h-6 text-slate-500 group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </CardContent>
            </Card>
          </button>
        </div>

        {/* Quick Tips */}
        <div className="mt-8 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
          <h3 className="text-white font-medium mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Quick Tips
          </h3>
          <ul className="space-y-2 text-slate-400 text-sm">
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Add a clear photo to increase match chances
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Be specific about the location where you lost/found the item
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Include unique identifying marks (scratches, stickers, etc.)
            </li>
          </ul>
        </div>

        {/* Back to Map */}
        <div className="mt-6 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Map
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ReportSelector;
