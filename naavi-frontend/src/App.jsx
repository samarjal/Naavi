import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import StatsBar from './components/StatsBar';
import DestinationShowcase from './components/DestinationShowcase';
import PhilosophySection from './components/PhilosophySection';
import TravelGuidesSection from './components/TravelGuidesSection';
import InterestsSection from './components/InterestsSection';
import UsefulByDesignSection from './components/UsefulByDesignSection';
import CtaBanner from './components/CtaBanner';
import Footer from './components/Footer';

const BASE_URL = 'http://localhost:8080';

const hasRequiredPreferences = (preferences) => {
  const requiredFields = [
    'foodPreference',
    'localTravelPreference',
    'accommodationPreference',
    'travelStyle',
    'transportationPreference',
  ];

  return requiredFields.every((field) => Boolean(preferences?.[field]));
};

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkPreferences = async () => {
      const token = localStorage.getItem('naaviToken');

      if (!token || location.pathname !== '/') {
        return;
      }

      try {
        const response = await axios.get(`${BASE_URL}/api/users/me/preferences`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!hasRequiredPreferences(response.data)) {
          navigate('/preferences', { replace: true });
        }
      } catch (error) {
        if (error.response?.status === 404 || error.response?.status === 400) {
          navigate('/preferences', { replace: true });
          return;
        }

        if (error.response?.status === 401) {
          localStorage.removeItem('naaviToken');
          localStorage.removeItem('naaviUser');
          navigate('/login', { replace: true });
        }
      }
    };

    checkPreferences();
  }, [location.pathname, navigate]);

  const openChatbot = () => navigate('/chatbot');

  return (
    <div className="min-h-screen bg-[#FDFCF9] text-gray-800 font-sans selection:bg-coral-500 selection:text-white">
      <Navbar onOpenModal={openChatbot} />

      <main>
        <HeroSection 
          searchInput="" 
          setSearchInput={() => {}} 
          onOpenModal={openChatbot} 
        />
        <StatsBar />
        <DestinationShowcase 
          searchInput="" 
          onOpenModal={openChatbot} 
        />

        <PhilosophySection onOpenModal={openChatbot} />
        <TravelGuidesSection onOpenModal={openChatbot} />
        <InterestsSection />
        <UsefulByDesignSection onOpenModal={openChatbot} />
        <CtaBanner onOpenModal={openChatbot} />
      </main>

      <Footer />
    </div>
  );
}