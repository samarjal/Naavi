import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import AuthPage from './pages/AuthPage.jsx';
import PreferencesPage from './pages/PreferencesPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import ChatbotPage from './pages/ChatbotPage.jsx';
import TripHistoryPage from './pages/TripHistoryPage.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/signup" element={<AuthPage />} />
        <Route path="/preferences" element={<PreferencesPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/chatbot" element={<ChatbotPage />} />
        <Route path="/trips" element={<TripHistoryPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
