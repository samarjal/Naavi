import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarRange, Compass, LoaderCircle, MapPinned, Share2, Trash2 } from 'lucide-react';

const BASE_URL = 'http://localhost:8080';

export default function TripHistoryPage() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTrips = async () => {
    const token = localStorage.getItem('naaviToken');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(`${BASE_URL}/api/trips`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTrips(response.data || []);
    } catch (err) {
      if (err?.response?.status === 401) {
        localStorage.removeItem('naaviToken');
        localStorage.removeItem('naaviUser');
        navigate('/login', { replace: true });
        return;
      }
      setError(err?.response?.data?.message || err?.response?.data?.error || 'Unable to load trips.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, [navigate]);

  const handleOpenTrip = (tripId) => navigate('/chatbot', { state: { tripId } });

  const handleDeleteTrip = async (tripId) => {
    const token = localStorage.getItem('naaviToken');
    try {
      await axios.delete(`${BASE_URL}/api/trips/${tripId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTrips((current) => current.filter((trip) => trip.id !== tripId));
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || 'Unable to delete trip.');
    }
  };

  const handleShareTrip = async (tripId) => {
    const token = localStorage.getItem('naaviToken');
    try {
      const response = await axios.post(
        `${BASE_URL}/api/trips/${tripId}/share`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const shareUrl = response.data?.shareUrl || response.data?.url;
      if (shareUrl) {
        await navigator.clipboard.writeText(shareUrl);
        alert('Share link copied to clipboard.');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || 'Unable to share trip.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F3EB] text-[#152B24]">
        <div className="flex items-center gap-3 rounded-full border border-[#D9CFBE] bg-white px-5 py-3 shadow-sm">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          Loading trips...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F3EB] px-4 py-8 text-[#152B24] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F79041] text-[#152B24] shadow-sm">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5A6F68]">Your trips</p>
              <h1 className="font-serif text-3xl">Trip history</h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/chatbot')}
            className="inline-flex items-center gap-2 rounded-full bg-[#152B24] px-4 py-2.5 text-sm font-semibold text-white"
          >
            <ArrowRight className="h-4 w-4" />
            Start planning
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-[#F1B7B1] bg-[#FFF2F0] px-4 py-3 text-sm text-[#7A2B2B]">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {trips.length === 0 ? (
            <div className="md:col-span-2 xl:col-span-3 rounded-4xl border border-dashed border-[#D9CFBE] bg-white p-8 text-center text-[#5A6F68] shadow-[0_20px_50px_rgba(21,43,36,0.04)]">
              No trips yet. Start a new adventure and Naavi will save it here.
            </div>
          ) : (
            trips.map((trip) => (
              <article key={trip.id} className="rounded-4xl border border-[#D9CFBE] bg-white p-5 shadow-[0_20px_50px_rgba(21,43,36,0.06)]">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5A6F68]">{trip.status || 'DRAFT'}</div>
                    <h2 className="mt-1 text-xl font-semibold text-[#152B24]">{trip.title || 'Unnamed trip'}</h2>
                  </div>
                  <span className="rounded-full bg-[#EEF7F2] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#2E6358]">
                    {trip.days || 0} days
                  </span>
                </div>

                <div className="space-y-3 text-sm text-[#425B55]">
                  <div className="flex items-center gap-2">
                    <MapPinned className="h-4 w-4 text-[#49655C]" />
                    <span>{trip.source || 'Start'} → {trip.destination || 'Destination'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarRange className="h-4 w-4 text-[#49655C]" />
                    <span>{trip.startDate || 'Dates TBD'} {trip.endDate ? `to ${trip.endDate}` : ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#152B24]">Budget:</span>
                    <span>{trip.budget ? `₹${trip.budget}` : 'Not set'}</span>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenTrip(trip.id)}
                    className="inline-flex items-center gap-2 rounded-full bg-[#F79041] px-3 py-2 text-sm font-semibold text-[#1A231F]"
                  >
                    Open trip
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleShareTrip(trip.id)}
                      className="rounded-full border border-[#D9CFBE] p-2 text-[#152B24]"
                      aria-label="Share trip"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTrip(trip.id)}
                      className="rounded-full border border-[#F1B7B1] p-2 text-[#7A2B2B]"
                      aria-label="Delete trip"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
