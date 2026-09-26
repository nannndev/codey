import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { ThemeProvider } from './components/ThemeProvider';
import { PreferencesProvider } from './components/PreferencesProvider';
import { AuthProvider } from './components/AuthProvider';
import App from './App';
import { Pages, preloadRoutes } from './routes/lazy';
import { PageFallback } from './components/PageFallback';
import { RadioProvider } from './components/RadioProvider';
import { FlowRadioWidget } from './components/FlowRadioWidget';
import { CommandPalette } from './components/CommandPalette';
import { KeycapStudioModal } from './components/KeycapStudioModal';
import './index.css';

const { Settings, History, Leaderboard, Profile, Donate, Contributors, Duel, Arcade, Daily, KeyboardAnalytics } = Pages;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <PreferencesProvider>
        <AuthProvider>
          <RadioProvider>
            <BrowserRouter>
              <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<App />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/history" element={<History />} />
                <Route path="/statistics" element={<History />} />
                <Route path="/stats" element={<History />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/daily" element={<Daily />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/profile/:userId" element={<Profile />} />
                <Route path="/duel" element={<Duel />} />
                <Route path="/race" element={<Duel />} />
                <Route path="/arcade" element={<Arcade />} />
                <Route path="/analytics/keyboard" element={<KeyboardAnalytics />} />
                <Route path="/donate" element={<Donate />} />
                <Route path="/support" element={<Donate />} />
                <Route path="/contributors" element={<Contributors />} />
              </Routes>
              </Suspense>
              <FlowRadioWidget />
              <CommandPalette />
              <KeycapStudioModal />
            </BrowserRouter>
            <Analytics />
          </RadioProvider>
        </AuthProvider>
      </PreferencesProvider>
    </ThemeProvider>
  </StrictMode>,
);

preloadRoutes();
