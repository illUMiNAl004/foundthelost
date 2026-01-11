/**
 * App.jsx
 * Main application component with routing and layout
 */

import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ToastProvider } from './components/Common/Toast';

// Auth Components
import Login from './components/Auth/Login';
import SignUp from './components/Auth/SignUp';
import ProtectedRoute from './components/Auth/ProtectedRoute';

// Navigation Components
import Navbar from './components/Navigation/Navbar';
import BottomNav from './components/Navigation/BottomNav';

// Map Components
import MapContainer from './components/Map/MapContainer';

// Form Components
import ReportSelector from './components/Forms/ReportSelector';
import ReportLostItem from './components/Forms/ReportLostItem';
import ReportFoundItem from './components/Forms/ReportFoundItem';
import SubmissionSuccess from './components/Forms/SubmissionSuccess';

// Item Components
import ItemDetail from './components/Items/ItemDetail';
import MyItems from './components/Items/MyItems';

// Messaging Components
import ChatList from './components/Messaging/ChatList';
import ChatThread from './components/Messaging/ChatThread';

// Profile Components
import UserProfile from './components/Profile/UserProfile';
import Leaderboard from './components/Profile/Leaderboard';
import Settings from './components/Profile/Settings';

// Layout wrapper component
const Layout = ({ children, hideNav = false }) => {
  const location = useLocation();

  // Pages where we hide the navbar
  const hideNavPaths = ['/login', '/signup'];
  const shouldHideNav = hideNav || hideNavPaths.some(path => location.pathname.startsWith(path));

  // Chat thread page - hide bottom nav, show back button
  const isChatThread = location.pathname.startsWith('/chat/') && location.pathname !== '/chat';

  // Map page needs full height for the map to render
  const isMapPage = location.pathname === '/';

  return (
    <div className="min-h-screen h-screen bg-slate-950 flex flex-col">
      {!shouldHideNav && <Navbar />}
      <main className={`flex-1 ${!shouldHideNav ? 'pt-0 md:pt-16' : ''} ${!shouldHideNav && !isChatThread ? 'pb-16 md:pb-0' : ''} ${isMapPage ? 'h-full' : ''}`}>
        {children}
      </main>
      {!shouldHideNav && !isChatThread && <BottomNav />}
    </div>
  );
};

// Search page component (redirects to map with search focus)
const SearchPage = () => {
  return <Navigate to="/?search=true" replace />;
};

// New chat page (start conversation)
const NewChat = () => {
  const location = useLocation();
  // Extract userId from path and any query params
  // This would redirect to chat thread after creating conversation
  return (
    <div className="min-h-screen bg-slate-950 pt-16 pb-20 md:pb-8 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400">Starting conversation...</p>
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Auth Routes (no layout) */}
            <Route path="/login" element={
              <Layout hideNav>
                <Login />
              </Layout>
            } />
            <Route path="/signup" element={
              <Layout hideNav>
                <SignUp />
              </Layout>
            } />

            {/* Main Map (Home) */}
            <Route path="/" element={
              <Layout>
                <MapContainer />
              </Layout>
            } />

            {/* Search (redirects to map) */}
            <Route path="/search" element={
              <Layout>
                <SearchPage />
              </Layout>
            } />

            {/* Report Routes */}
            <Route path="/report" element={
              <ProtectedRoute>
                <Layout>
                  <ReportSelector />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/report/lost" element={
              <ProtectedRoute>
                <Layout>
                  <ReportLostItem />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/report/found" element={
              <ProtectedRoute>
                <Layout>
                  <ReportFoundItem />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/report/success" element={
              <ProtectedRoute>
                <Layout hideNav>
                  <SubmissionSuccess />
                </Layout>
              </ProtectedRoute>
            } />

            {/* Item Routes */}
            <Route path="/item/:type/:id" element={
              <Layout>
                <ItemDetail />
              </Layout>
            } />
            <Route path="/my-items" element={
              <ProtectedRoute>
                <Layout>
                  <MyItems />
                </Layout>
              </ProtectedRoute>
            } />

            {/* Chat Routes */}
            <Route path="/chat" element={
              <ProtectedRoute>
                <Layout>
                  <ChatList />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/chat/new/:userId" element={
              <ProtectedRoute>
                <Layout>
                  <NewChat />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/chat/:conversationId" element={
              <ProtectedRoute>
                <Layout>
                  <ChatThread />
                </Layout>
              </ProtectedRoute>
            } />

            {/* Profile Routes */}
            <Route path="/profile" element={
              <ProtectedRoute>
                <Layout>
                  <UserProfile />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/profile/:userId" element={
              <Layout>
                <UserProfile />
              </Layout>
            } />

            {/* Leaderboard */}
            <Route path="/leaderboard" element={
              <Layout>
                <Leaderboard />
              </Layout>
            } />

            {/* Settings */}
            <Route path="/settings" element={
              <ProtectedRoute>
                <Layout>
                  <Settings />
                </Layout>
              </ProtectedRoute>
            } />

            {/* 404 - Redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
