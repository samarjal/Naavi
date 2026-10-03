import React, { useState } from 'react';
import { X, Sparkles, MapPin, Calendar, CheckCircle } from 'lucide-react';

export default function AiGeneratorModal({ isOpen, onClose, initialDestination }) {
  const [step, setStep] = useState(1);
  const [destination, setDestination] = useState(initialDestination || '');
  const [days, setDays] = useState('3');
  const [pace, setPace] = useState('Balanced');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setIsComplete(true);
    }, 2000);
  };

  const resetModal = () => {
    setStep(1);
    setIsComplete(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 relative shadow-2xl space-y-6">
        {/* Close Button */}
        <button 
          onClick={resetModal}
          className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 p-1"
        >
          <X className="w-6 h-6" />
        </button>

        {!isComplete ? (
          <>
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-coral-500 uppercase tracking-widest">
                <Sparkles className="w-4 h-4" />
                <span>AI Itinerary Builder</span>
              </div>
              <h3 className="text-2xl font-serif font-bold text-gray-900">
                Design your custom trip
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Destination</label>
                <div className="flex items-center border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50">
                  <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                  <input 
                    type="text" 
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="e.g. Kyoto, Barcelona, Iceland"
                    className="w-full bg-transparent text-sm text-gray-800 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Trip Duration (Days)</label>
                <div className="flex items-center border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50">
                  <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                  <input 
                    type="number" 
                    min="1" 
                    max="14"
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    className="w-full bg-transparent text-sm text-gray-800 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Pacing Preference</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Fast', 'Balanced', 'Relaxed'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPace(p)}
                      className={`py-2 text-xs font-medium rounded-xl border transition-all ${
                        pace === p 
                          ? 'bg-forest-900 text-white border-forest-900' 
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !destination}
              className="w-full bg-coral-500 hover:bg-coral-600 disabled:opacity-50 text-white font-medium py-3.5 rounded-full text-sm transition-all shadow-md flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>Curating route & schedule...</span>
                </>
              ) : (
                <>
                  <span>Build {days}-Day Itinerary</span>
                  <Sparkles className="w-4 h-4" />
                </>
              )}
            </button>
          </>
        ) : (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-serif font-bold text-gray-900">Your trip is ready!</h3>
            <p className="text-sm text-gray-600">
              We generated a custom {days}-day ({pace}) route for <span className="font-bold text-forest-900">{destination || 'your destination'}</span>.
            </p>
            <button 
              onClick={resetModal}
              className="bg-forest-900 text-white font-medium px-8 py-3 rounded-full text-sm hover:bg-forest-800 transition-colors"
            >
              View Generated Itinerary
            </button>
          </div>
        )}
      </div>
    </div>
  );
}