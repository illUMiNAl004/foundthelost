/**
 * BottomNav Component
 * Mobile navigation bar fixed at the bottom
 */

import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const BottomNav = () => {
  const location = useLocation();
  const { user, profile } = useAuth();

  // Navigation items
  const navItems = [
    {
      path: '/',
      label: 'Map',
      icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
    },
    {
      path: '/search',
      label: 'Search',
      icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    },
    {
      path: '/report',
      label: 'Report',
      icon: 'M12 4v16m8-8H4',
      isCenter: true,
    },
    {
      path: '/chat',
      label: 'Chat',
      icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      badge: 0, // Unread count would be passed as prop in real app
    },
    {
      path: user ? '/profile' : '/login',
      label: user ? 'Profile' : 'Login',
      icon: user ? null : 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      avatar: user ? profile?.avatar_url : null,
      initial: user ? profile?.name?.[0]?.toUpperCase() || 'U' : null,
    },
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 z-50 safe-area-bottom">
      <div className="flex items-center justify-around h-full px-2">
        {navItems.map((item) => {
          const active = isActive(item.path);

          // Center "Report" button with special styling
          if (item.isCenter) {
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex flex-col items-center justify-center -mt-6"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 ring-4 ring-slate-900">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={item.icon} />
                  </svg>
                </div>
                <span className="text-[10px] font-medium text-emerald-400 mt-1">
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex flex-col items-center justify-center flex-1 py-1 min-w-0 transition-all
                ${active ? 'text-emerald-400' : 'text-slate-500'}
              `}
            >
              {/* Icon or Avatar */}
              <div className="relative">
                {item.avatar ? (
                  <img
                    src={item.avatar}
                    alt="Profile"
                    className={`w-6 h-6 rounded-full object-cover ${active ? 'ring-2 ring-emerald-400' : ''}`}
                  />
                ) : item.initial ? (
                  <div
                    className={`
                      w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold
                      ${active
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-700 text-slate-300'
                      }
                    `}
                  >
                    {item.initial}
                  </div>
                ) : (
                  <svg
                    className={`w-6 h-6 ${active ? 'stroke-2' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={active ? 2.5 : 2}
                      d={item.icon}
                    />
                  </svg>
                )}

                {/* Badge for unread messages */}
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className={`
                  text-[10px] mt-0.5 truncate max-w-full
                  ${active ? 'font-semibold' : 'font-medium'}
                `}
              >
                {item.label}
              </span>

              {/* Active indicator dot */}
              {active && (
                <div className="w-1 h-1 bg-emerald-400 rounded-full mt-0.5" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
