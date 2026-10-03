import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  Compass,
  Copy,
  LoaderCircle,
  MapPinned,
  MessageSquareText,
  Plus,
  Share2,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';

const BASE_URL = 'http://localhost:8080';

const defaultTrip = {
  id: null,
  title: 'New trip',
  source: '',
  destination: '',
  budget: '',
  travelers: '',
  days: '',
  startDate: '',
  endDate: '',
  specialRequirements: '',
  status: 'DRAFT',
};

const pathFromTrip = (trip) => {
  if (!trip?.destination && !trip?.source) return 'New trip';
  if (trip?.destination && trip?.source) return `${trip.source} → ${trip.destination}`;
  return trip?.destination || trip?.source || 'New trip';
};

const sanitizeTrip = (trip) => ({
  ...defaultTrip,
  ...trip,
  budget: trip?.budget ?? '',
  travelers: trip?.travelers ?? '',
  days: trip?.days ?? '',
  startDate: trip?.startDate ?? '',
  endDate: trip?.endDate ?? '',
  title: trip?.title || pathFromTrip(trip) || 'New trip',
});

const formatCurrency = (value) => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(parsed);
};

const formatDayLabel = (value) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function ChatbotPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => localStorage.getItem('naaviToken'));
  const [trip, setTrip] = useState(defaultTrip);
  const [itinerary, setItinerary] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [shareUrl, setShareUrl] = useState('');
  const [copyState, setCopyState] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    const loadTrips = async () => {
      try {
        const response = await axios.get(`${BASE_URL}/api/trips`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const trips = response.data || [];
        setHistory(trips);

        if (trips.length) {
          const latest = trips[0];
          setSelectedTripId(latest.id);
          setTrip(sanitizeTrip(latest));
          await loadChat(latest.id, latest);
        } else {
          setSelectedTripId(null);
          setTrip(defaultTrip);
          setItinerary(null);
          setMessages([
            {
              id: 'intro',
              role: 'assistant',
              content:
                'Hi! Tell me where you want to go, your travel dates, budget, and number of travellers, and I will build your trip.',
            },
          ]);
          setLoading(false);
        }
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401) {
          localStorage.removeItem('naaviToken');
          localStorage.removeItem('naaviUser');
          navigate('/login', { replace: true });
          return;
        }
        setError('Unable to load your trip history right now.');
        setLoading(false);
      }
    };

    loadTrips();
  }, [navigate, token]);

  const loadChat = async (tripId, tripRecord = null) => {
    try {
      const [tripResponse, chatResponse] = await Promise.all([
        axios.get(`${BASE_URL}/api/trips/${tripId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${BASE_URL}/api/trips/${tripId}/chat`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const selectedTrip = sanitizeTrip(tripResponse.data?.trip || tripRecord || tripResponse.data);
      const nextItinerary = tripResponse.data?.itinerary ?? null;
      setTrip(selectedTrip);
      setItinerary(nextItinerary);

      const chatMessages = (chatResponse.data || []).map((msg) => ({
        id: msg.id,
        role: msg.role === 'ASSISTANT' ? 'assistant' : 'user',
        content: msg.content,
      }));

      const combined = chatMessages.length
        ? chatMessages
        : [
            {
              id: `welcome-${tripId}`,
              role: 'assistant',
              content: `Hi! I’m ready to continue your ${selectedTrip.destination || 'trip'} plan.`,
            },
          ];

      setMessages(combined);
      setLoading(false);
      setError('');
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) {
        localStorage.removeItem('naaviToken');
        localStorage.removeItem('naaviUser');
        navigate('/login', { replace: true });
        return;
      }
      setError('Unable to load this trip.');
      setLoading(false);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!draft.trim()) return;

    const message = draft.trim();
    setDraft('');
    setSending(true);
    setError('');

    try {
      const payload = selectedTripId
        ? { tripId: selectedTripId, message }
        : { message };

      const response = await axios.post(`${BASE_URL}/api/travel/plan`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const resultTrip = sanitizeTrip(response.data?.trip || {});
      const nextTripId = resultTrip.id || response.data?.trip?.id || selectedTripId;

      if (nextTripId) {
        setSelectedTripId(nextTripId);
        setTrip(resultTrip);
        setItinerary(response.data?.itinerary ?? null);

        const existing = history.find((item) => item.id === nextTripId);
        if (!existing) {
          setHistory((current) => [{ ...resultTrip, id: nextTripId }, ...current]);
        }
      }

      setMessages((current) => [
        ...current,
        { id: `user-${Date.now()}`, role: 'user', content: message },
        {
          id: `assistant-${Date.now() + 1}`,
          role: 'assistant',
          content: response.data?.reply || 'I’ve saved your request and I’m ready to continue.',
        },
      ]);

      if (nextTripId) {
        await loadChat(nextTripId, resultTrip);
      }
    } catch (err) {
      const apiMessage = err?.response?.data?.message || err?.response?.data?.error || 'Unable to send your message.';
      setError(apiMessage);
      setMessages((current) => [
        ...current,
        { id: `user-${Date.now()}`, role: 'user', content: message },
        { id: `assistant-${Date.now() + 1}`, role: 'assistant', content: `I hit an issue: ${apiMessage}` },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleReuseTrip = async (tripId) => {
    setSelectedTripId(tripId);
    setLoading(true);
    await loadChat(tripId);
  };

  const handleNewTrip = () => {
    setSelectedTripId(null);
    setTrip(defaultTrip);
    setItinerary(null);
    setMessages([
      {
        id: 'new-trip',
        role: 'assistant',
        content: 'New trip started. Tell me where you want to go, when you plan to travel, and your budget.',
      },
    ]);
    setError('');
  };

  const handleShare = async () => {
    if (!selectedTripId) return;
    try {
      const response = await axios.post(
        `${BASE_URL}/api/trips/${selectedTripId}/share`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const url = response.data?.shareUrl || response.data?.url || 'Share link unavailable';
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      setCopyState('Link copied');
      setTimeout(() => setCopyState(''), 1800);
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || 'Unable to create a share link.');
    }
  };

  const handleDeleteTrip = async () => {
    if (!selectedTripId) return;
    try {
      await axios.delete(`${BASE_URL}/api/trips/${selectedTripId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHistory((current) => current.filter((item) => item.id !== selectedTripId));
      handleNewTrip();
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || 'Unable to delete this trip.');
    }
  };

  const currentTripSummary = useMemo(() => pathFromTrip(trip), [trip]);
  const summary = itinerary?.tripSummary || {};
  const expenses = itinerary?.expenses || {};
  const travelDays = itinerary?.days || [];
  const warnings = itinerary?.validationWarnings || [];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream text-[#152B24]">
        <div className="flex items-center gap-3 rounded-full border border-[#D9CFBE] bg-white px-5 py-3 shadow-sm">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          Loading trip planner...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream px-4 py-6 text-[#152B24] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F79041] text-[#152B24] shadow-sm">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5A6F68]">Naavi planner</p>
              <h1 className="font-serif text-3xl">Trip planner</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleNewTrip}
              className="inline-flex items-center gap-2 rounded-full border border-[#D9CFBE] bg-white px-3 py-2 text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              New trip
            </button>
            <button
              type="button"
              onClick={() => navigate('/trips')}
              className="inline-flex items-center gap-2 rounded-full bg-[#152B24] px-3 py-2 text-sm font-medium text-white"
            >
              <MessageSquareText className="h-4 w-4" />
              My trips
            </button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-4xl border border-[#D9CFBE] bg-white p-4 shadow-[0_20px_50px_rgba(21,43,36,0.08)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Trips</h2>
              <span className="rounded-full bg-[#EAF3EE] px-2 py-1 text-xs font-semibold text-[#2E6358]">
                {history.length}
              </span>
            </div>

            <div className="space-y-2">
              {history.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#D9CFBE] bg-[#F8F6F2] p-4 text-sm text-[#5A6F68]">
                  No saved trips yet.
                </div>
              ) : (
                history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleReuseTrip(item.id)}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      selectedTripId === item.id
                        ? 'border-[#F79041] bg-[#FFF8F1]'
                        : 'border-[#E6E0D8] bg-[#F9F7F4] hover:border-[#C8D9D2]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-[#152B24]">{pathFromTrip(item)}</span>
                      <span className="rounded-full bg-[#EDF4F1] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#2E6358]">
                        {item.status || 'DRAFT'}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-[#5A6F68]">
                      {item.source || 'Start'} → {item.destination || 'destination'}
                    </div>
                    <div className="mt-1 text-[11px] text-[#5A6F68]">
                      {item.budget ? `Budget ₹${item.budget}` : 'Budget not set'} • {item.days || 0} days
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="rounded-4xl border border-[#D9CFBE] bg-white shadow-[0_20px_50px_rgba(21,43,36,0.08)]">
            <div className="border-b border-[#EFE6DC] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5A6F68]">Current trip</p>
                  <h2 className="mt-1 font-serif text-2xl">{currentTripSummary}</h2>
                </div>

                <div className="flex items-center gap-2">
                  {selectedTripId && (
                    <button
                      type="button"
                      onClick={handleShare}
                      className="inline-flex items-center gap-2 rounded-full border border-[#D9CFBE] bg-[#F8F5F1] px-3 py-2 text-sm font-medium"
                    >
                      <Share2 className="h-4 w-4" />
                      Share
                    </button>
                  )}
                  {selectedTripId && (
                    <button
                      type="button"
                      onClick={handleDeleteTrip}
                      className="inline-flex items-center gap-2 rounded-full border border-[#F1B7B1] bg-[#FFF3F1] px-3 py-2 text-sm font-medium text-[#7A2B2B]"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {shareUrl && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[#D8E8E2] bg-[#F2FBF6] px-3 py-2 text-sm text-[#1B4D3A]">
                  <span className="truncate">{shareUrl}</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(shareUrl)}
                    className="inline-flex items-center gap-2 rounded-full bg-[#152B24] px-2.5 py-1.5 text-xs font-medium text-white"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copyState || 'Copy'}
                  </button>
                </div>
              )}
            </div>

            {itinerary && (
              <div className="border-b border-[#EFE6DC] bg-[#FAF7F2] p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5A6F68]">Itinerary overview</p>
                    <h3 className="mt-1 font-serif text-2xl text-[#152B24]">
                      {summary.title || `${trip.source || 'Trip'} to ${trip.destination || 'destination'}`}
                    </h3>
                  </div>
                  <div className="rounded-full bg-[#EAF3EE] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#2E6358]">
                    {itinerary.planType || 'BUDGET'} · v{itinerary.version || 1}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-[#EDE2D6] bg-white p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5A6F68]">Budget</p>
                    <p className="mt-2 text-lg font-semibold text-[#152B24]">{formatCurrency(expenses.total || trip.budget || 0)}</p>
                    <p className="mt-1 text-xs text-[#5A6F68]">of {formatCurrency(expenses.budget || trip.budget || 0)} planned</p>
                  </div>

                  <div className="rounded-2xl border border-[#EDE2D6] bg-white p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5A6F68]">Travellers</p>
                    <p className="mt-2 text-lg font-semibold text-[#152B24]">{trip.travelers || summary.travelers || 1}</p>
                    <p className="mt-1 text-xs text-[#5A6F68]">
                      {summary.source || trip.source || 'Departure'} → {summary.destination || trip.destination || 'Destination'}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#EDE2D6] bg-white p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5A6F68]">Dates</p>
                    <p className="mt-2 text-lg font-semibold text-[#152B24]">{trip.days || summary.days || travelDays.length || 0} days</p>
                    <p className="mt-1 text-xs text-[#5A6F68]">
                      {formatDayLabel(trip.startDate)} • {formatDayLabel(trip.endDate)}
                    </p>
                  </div>
                </div>

                {summary.highlights?.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-[#EDE2D6] bg-white p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5A6F68]">Highlights</p>
                    <ul className="mt-2 space-y-2 text-sm text-[#2D3A35]">
                      {summary.highlights.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="mt-1 inline-block h-2 w-2 rounded-full bg-[#F79041]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {warnings.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-[#F1D3AB] bg-[#FFF9F1] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7C4800]">Warnings</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#7C4800]">
                      {warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-[#EDE2D6] bg-white p-3">
                    <div className="mb-2 flex items-center gap-2 text-[#152B24]">
                      <MapPinned className="h-4 w-4 text-[#F79041]" />
                      <span className="text-sm font-semibold">Transportation</span>
                    </div>
                    <div className="space-y-3">
                      {(itinerary.transportation || []).map((item, index) => (
                        <div key={`${item.mode}-${index}`} className="rounded-xl bg-[#F8F5F1] p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-[#152B24]">{item.mode}</span>
                            {item.recommended && (
                              <span className="rounded-full bg-[#EAF3EE] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#2E6358]">
                                Recommended
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-[#5A6F68]">
                            {item.from} → {item.to}
                          </p>
                          <p className="mt-1 text-xs text-[#5A6F68]">
                            {item.durationHours} hrs • {formatCurrency(item.costPerPerson || 0)} / person
                          </p>
                          <p className="mt-1 text-xs text-[#5A6F68]">{item.notes}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#EDE2D6] bg-white p-3">
                    <div className="mb-2 flex items-center gap-2 text-[#152B24]">
                      <Sparkles className="h-4 w-4 text-[#F79041]" />
                      <span className="text-sm font-semibold">Accommodation</span>
                    </div>
                    <div className="space-y-3">
                      {(itinerary.accommodation || []).map((item, index) => (
                        <div key={`${item.name}-${index}`} className="rounded-xl bg-[#F8F5F1] p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-[#152B24]">{item.name}</span>
                            {item.recommended && (
                              <span className="rounded-full bg-[#EAF3EE] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#2E6358]">
                                Best fit
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-[#5A6F68]">
                            {item.area} • {item.category}
                          </p>
                          <p className="mt-1 text-xs text-[#5A6F68]">
                            {item.nights} nights • {formatCurrency(item.pricePerNight || 0)} / night
                          </p>
                          <p className="mt-2 text-xs text-[#5A6F68]">{item.amenities?.join(', ')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-[#EDE2D6] bg-white p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#152B24]">Travel plan</p>
                    <span className="text-xs text-[#5A6F68]">{travelDays.length} days</span>
                  </div>
                  <div className="space-y-4">
                    {(travelDays || []).map((day) => (
                      <div key={day.dayNumber} className="rounded-2xl border border-[#EFE6DC] bg-[#F9F7F4] p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <h4 className="text-sm font-semibold text-[#152B24]">Day {day.dayNumber}</h4>
                          <span className="text-[11px] text-[#5A6F68]">{day.theme}</span>
                        </div>
                        <p className="mb-2 text-xs text-[#5A6F68]">{day.weatherNote}</p>
                        <div className="space-y-2">
                          {(day.activities || []).map((activity, index) => (
                            <div
                              key={`${day.dayNumber}-${activity.title}-${index}`}
                              className="rounded-xl border border-[#EAE1D8] bg-white p-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5A6F68]">
                                  {activity.time}
                                </span>
                                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#2E6358]">
                                  {activity.type}
                                </span>
                              </div>
                              <p className="mt-1 text-sm font-medium text-[#152B24]">{activity.title}</p>
                              <p className="mt-1 text-xs text-[#5A6F68]">{activity.description}</p>
                              {activity.area && <p className="mt-1 text-[11px] text-[#5A6F68]">Area: {activity.area}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {itinerary.packingChecklist?.length > 0 && (
                  <div className="mt-5 rounded-2xl border border-[#EDE2D6] bg-white p-3">
                    <p className="text-sm font-semibold text-[#152B24]">Packing checklist</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#2D3A35]">
                      {itinerary.packingChecklist.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {expenses.items?.length > 0 && (
                  <div className="mt-5 rounded-2xl border border-[#EDE2D6] bg-white p-3">
                    <p className="text-sm font-semibold text-[#152B24]">Budget breakdown</p>
                    <div className="mt-3 space-y-2">
                      {expenses.items.map((item, index) => (
                        <div
                          key={`${item.category}-${index}`}
                          className="flex items-center justify-between gap-3 rounded-xl bg-[#F9F7F4] px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium text-[#152B24]">{item.description}</p>
                            <p className="text-[11px] text-[#5A6F68]">{item.category}</p>
                          </div>
                          <span className="text-sm font-semibold text-[#152B24]">{formatCurrency(item.amount || 0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex h-135 flex-col">
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-3xl px-4 py-3 ${
                        message.role === 'user'
                          ? 'bg-[#152B24] text-white'
                          : 'border border-[#EAE1D8] bg-[#F8F6F2] text-[#152B24]'
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-current/70">
                        {message.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                        {message.role === 'user' ? 'You' : 'Naavi'}
                      </div>
                      <p className="whitespace-pre-line text-sm leading-6">{message.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {error && (
                <div className="mx-4 mb-2 rounded-2xl border border-[#F1B7B1] bg-[#FFF2F0] px-3 py-2 text-sm text-[#7A2B2B]">
                  {error}
                </div>
              )}

              <form onSubmit={sendMessage} className="border-t border-[#EFE6DC] p-4">
                <div className="flex items-end gap-3 rounded-3xl border border-[#D9CFBE] bg-[#F9F6F2] p-3 shadow-sm">
                  <textarea
                    rows={1}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Plan a 5-day Goa trip for 2 people under 30000..."
                    className="max-h-32 min-h-13 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm text-[#152B24] placeholder:text-[#77857F] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#F79041] px-4 py-3 text-sm font-semibold text-[#1A231F] transition hover:bg-[#E78339] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    {sending ? 'Planning...' : 'Send'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
