import React, { useState } from 'react';
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
import AiGeneratorModal from './components/AiGeneratorModal';

export default function App() {
  const [searchInput, setSearchInput] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#FDFCF9] text-gray-800 font-sans selection:bg-coral-500 selection:text-white">
      {/* Top Header */}
      <Navbar onOpenModal={() => setIsModalOpen(true)} />

      {/* Main Page Content */}
      <main>
        <HeroSection 
          searchInput={searchInput} 
          setSearchInput={setSearchInput} 
          onOpenModal={() => setIsModalOpen(true)} 
        />
        <StatsBar />
        <DestinationShowcase 
          searchInput={searchInput} 
          onOpenModal={() => setIsModalOpen(true)} 
        />
        
        <PhilosophySection onOpenModal={() => setIsModalOpen(true)} />
        <TravelGuidesSection onOpenModal={() => setIsModalOpen(true)} />
        <InterestsSection />
        <UsefulByDesignSection onOpenModal={() => setIsModalOpen(true)} />
        <CtaBanner onOpenModal={() => setIsModalOpen(true)} />
      </main>

      {/* Footer */}
      <Footer />

      {/* Interactive Generator Popup */}
      <AiGeneratorModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        initialDestination={searchInput} 
      />
    </div>
  );
}