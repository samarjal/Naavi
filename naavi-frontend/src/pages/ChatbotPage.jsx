import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUp,
  Check,
  ChevronDown,
  Compass,
  Copy,
  LoaderCircle,
  MapPinned,
  MessageSquareText,
  PanelLeft,
  Plus,
  Share2,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react';

const BASE_URL = 'http://localhost:8080';

/** Map transport modes to user-friendly labels */
const TRANSPORT_MODE_LABELS = {
  TRAIN: 'Train',
  BUS: 'Bus',
  FLIGHT: 'Flight',
  CAB: 'Private Cab',
};

/** Map travel classes to user-friendly labels */
const TRAVEL_CLASS_LABELS = {
  SL: 'Sleeper',
  CC: 'AC Chair Car',
  '3A': 'AC 3-Tier',
  '2A': 'AC 2-Tier',
  AC_SEATER: 'AC Seater',
  AC_SLEEPER: 'AC Sleeper',
  ECONOMY: 'Economy',
  SEDAN_OR_SUV: 'Sedan / SUV',
};

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

/* ---------- chat UI building blocks (Claude-style) ---------- */
function inline(s) {
  return s.split(/(\*\*[^*]+\*\*|https?:\/\/[^\s)]+)/g).map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (/^https?:\/\//.test(p)) {
      return <a key={i} href={p} target="_blank" rel="noreferrer" className="break-all text-[#2E6358] underline underline-offset-2">{p}</a>;
    }
    return p;
  });
}

function RichText({ text }) {
  return (
    <div className="space-y-3">
      {text.split(/\n{2,}/).map((block, i) => {
        const lines = block.split('\n');
        if (lines.every((l) => /^\s*[-•*]\s+/.test(l))) {
          return <ul key={i} className="list-disc space-y-1 pl-5">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-•*]\s+/, ''))}</li>)}</ul>;
        }
        if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
          return <ol key={i} className="list-decimal space-y-1 pl-5">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>)}</ol>;
        }
        return <p key={i} className="whitespace-pre-line">{inline(block)}</p>;
      })}
    </div>
  );
}

/** Reveals new assistant replies progressively, like streaming. */
function Typed({ text, animate, onTick, onDone }) {
  const [n, setN] = useState(animate ? 0 : text.length);
  const step = Math.max(3, Math.ceil(text.length / 100));
  useEffect(() => {
    if (n >= text.length) { onDone?.(); return undefined; }
    const id = setTimeout(() => setN((v) => Math.min(text.length, v + step)), 16);
    return () => clearTimeout(id);
  }, [n, text, step]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { onTick?.(); }, [n]); // eslint-disable-line react-hooks/exhaustive-deps
  return <RichText text={text.slice(0, n)} />;
}

function RecsPanel({ recommendations, onPlan, sending }) {
  const recommendationPlaces = Array.isArray(recommendations?.places) ? recommendations.places : [];
  return (
    <>
      {recommendationPlaces.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-[#D8E8E2] bg-[#F2FBF6] p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#2E6358]">Recommendations</p>
                            <p className="mt-1 text-sm text-[#2D3A35]">{recommendations?.query || 'Suggested places'}</p>
                          </div>
                          {recommendations?.generatedAt && (
                            <span className="text-[11px] text-[#5A6F68]">{formatDayLabel(recommendations.generatedAt)}</span>
                          )}
                        </div>

                        {recommendations?.dataNotice && (
                          <p className="mt-3 text-xs leading-5 text-[#5A6F68]">{recommendations.dataNotice}</p>
                        )}

                        <div className="mt-4 space-y-3">
                          {recommendationPlaces.map((place) => (
                            <div key={place.name} className="rounded-2xl border border-[#E1ECE7] bg-white p-3 shadow-sm">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <h4 className="text-base font-semibold text-[#152B24]">{place.name}</h4>
                                  <p className="text-xs text-[#5A6F68]">
                                    {[place.state, place.type].filter(Boolean).join(' • ')}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => onPlan(place.name)}
                                  disabled={sending}
                                  className="rounded-full bg-[#152B24] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#20362F] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Plan this trip
                                </button>
                              </div>

                              {place.whyVisit && <p className="mt-3 text-sm text-[#2D3A35]">{place.whyVisit}</p>}

                              {Array.isArray(place.highlights) && place.highlights.length > 0 && (
                                <ul className="mt-3 flex flex-wrap gap-2">
                                  {place.highlights.map((item) => (
                                    <li key={item} className="rounded-full bg-[#F8F5F1] px-3 py-1 text-xs text-[#5A6F68]">
                                      {item}
                                    </li>
                                  ))}
                                </ul>
                              )}

                              <div className="mt-3 grid gap-2 text-xs text-[#5A6F68] sm:grid-cols-2">
                                {place.bestTime && <p><span className="font-semibold text-[#152B24]">Best time:</span> {place.bestTime}</p>}
                                {place.idealDays != null && <p><span className="font-semibold text-[#152B24]">Ideal days:</span> {place.idealDays}</p>}
                                {place.estCostPerPersonPerDay != null && <p><span className="font-semibold text-[#152B24]">Est. per day:</span> {formatCurrency(place.estCostPerPersonPerDay)}</p>}
                                {place.suitability && <p><span className="font-semibold text-[#152B24]">Suitable for:</span> {place.suitability}</p>}
                              </div>

                              {place.howToReach && <p className="mt-3 text-xs text-[#5A6F68]"><span className="font-semibold text-[#152B24]">How to reach:</span> {place.howToReach}</p>}

                              {place.mapsUrl && (
                                <a
                                  href={place.mapsUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-3 inline-flex text-xs font-semibold text-[#2E6358] underline decoration-[#2E6358]/40 underline-offset-2"
                                >
                                  Open in Google Maps
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
    </>
  );
}

function ItineraryPanel({ itinerary, trip }) {
  const summary = itinerary?.tripSummary || {};
  const expenses = itinerary?.expenses || {};
  const travelDays = itinerary?.days || [];
  const warnings = itinerary?.validationWarnings || [];
  const weather = itinerary?.weather || {};
  const transportation = Array.isArray(itinerary?.transportation) ? itinerary.transportation : [];
  const accommodation = Array.isArray(itinerary?.accommodation) ? itinerary.accommodation : [];
  const packingChecklist = Array.isArray(itinerary?.packingChecklist) ? itinerary.packingChecklist : [];
  const expenseItems = Array.isArray(expenses.items) ? expenses.items : [];
  const assumptions = Array.isArray(itinerary?.assumptions) ? itinerary.assumptions : [];
  const preferencesUsed = itinerary?.preferencesUsed || {};
  const preferenceValues = preferencesUsed.values || {};
  const preferenceSources = preferencesUsed.sources || {};
  const preferenceNotes = preferencesUsed.notes || {};
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5A6F68]">Itinerary overview</p>
                        <h3 className="mt-1 font-serif text-2xl text-[#152B24]">
                          {summary.title || `${trip.source || 'Trip'} to ${trip.destination || 'destination'}`}
                        </h3>
                        <p className="mt-1 text-xs text-[#5A6F68]">
                          Version {itinerary.version || 1} • {itinerary.planType || 'BUDGET'} • {weather.mode || 'UNKNOWN'} weather
                        </p>
                      </div>
                      <div className="rounded-full bg-[#EAF3EE] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#2E6358]">
                        {trip.status || 'DRAFT'}
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-[#EDE2D6] bg-white p-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5A6F68]">Budget</p>
                        <p className="mt-2 text-lg font-semibold text-[#152B24]">{formatCurrency(expenses.total || trip.budget || 0)}</p>
                        <p className="mt-1 text-xs text-[#5A6F68]">
                          of {formatCurrency(expenses.budget || trip.budget || 0)} planned
                        </p>
                      </div>

                      <div className="rounded-2xl border border-[#EDE2D6] bg-white p-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5A6F68]">Travelers</p>
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

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-[#EDE2D6] bg-white p-3">
                        <div className="mb-2 flex items-center gap-2 text-[#152B24]">
                          <MapPinned className="h-4 w-4 text-[#F79041]" />
                          <span className="text-sm font-semibold">Transportation</span>
                        </div>
                        <div className="space-y-3">
                          {transportation.length ? transportation.map((item, index) => (
                            <div key={`${item.mode}-${index}`} className="rounded-xl bg-[#F8F5F1] p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-[#152B24]">{TRANSPORT_MODE_LABELS[item.mode] || item.mode}</span>
                                  {item.dataType === 'ESTIMATED' && (
                                    <span className="rounded-full bg-[#FFF3E0] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#E88D0A]">
                                      Estimated
                                    </span>
                                  )}
                                </div>
                                {item.recommended && (
                                  <span className="rounded-full bg-[#EAF3EE] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#2E6358]">
                                    Recommended
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-[#5A6F68]">{item.from} → {item.to}</p>
                              <p className="mt-1 text-xs text-[#5A6F68]">
                                {item.durationHours} hrs • {formatCurrency(item.costPerPerson || 0)} / person
                              </p>
                              {item.trainName && (
                                <p className="mt-1 text-xs text-[#5A6F68]">{item.trainName} {item.trainNumber ? `(${item.trainNumber})` : ''}</p>
                              )}
                              {(item.departureTime || item.arrivalTime) && (
                                <p className="mt-1 text-xs text-[#5A6F68]">
                                  {item.departureTime || '--'} → {item.arrivalTime || '--'} • {item.travelClass ? TRAVEL_CLASS_LABELS[item.travelClass] || item.travelClass : 'N/A'}
                                </p>
                              )}
                              {item.fareNote && <p className="mt-1 text-xs text-[#5A6F68]">{item.fareNote}</p>}
                              {item.bookingUrl && (
                                <a
                                  href={item.bookingUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-2 inline-flex text-xs font-semibold text-[#2E6358] underline decoration-[#2E6358]/40 underline-offset-2"
                                >
                                  {item.bookingProvider === 'IRCTC' ? 'Book via IRCTC' : 'Book now'}
                                </a>
                              )}
                              {item.bookingNote && <p className="mt-1 text-[11px] text-[#5A6F68]">{item.bookingNote}</p>}
                            </div>
                          )) : (
                            <p className="text-sm text-[#5A6F68]">No transportation details available.</p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[#EDE2D6] bg-white p-3">
                        <div className="mb-2 flex items-center gap-2 text-[#152B24]">
                          <Sparkles className="h-4 w-4 text-[#F79041]" />
                          <span className="text-sm font-semibold">Accommodation</span>
                        </div>
                        <div className="space-y-3">
                          {accommodation.length ? accommodation.map((item, index) => (
                            <div key={`${item.name}-${index}`} className="rounded-xl bg-[#F8F5F1] p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex flex-col">
                                  <span className="text-sm font-semibold text-[#152B24]">{item.name}</span>
                                  <div className="mt-1 flex items-center gap-2">
                                    {item.category && <span className="text-xs text-[#5A6F68]">{item.category}</span>}
                                    {item.dataType === 'ESTIMATED' && (
                                      <span className="rounded-full bg-[#FFF3E0] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#E88D0A]">
                                        Estimated
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {item.recommended && (
                                  <span className="rounded-full bg-[#EAF3EE] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#2E6358]">
                                    Best fit
                                  </span>
                                )}
                              </div>
                              {item.area && <p className="mt-2 text-xs text-[#5A6F68]">Area: {item.area}</p>}
                              <p className="mt-1 text-xs text-[#5A6F68]">
                                {item.nights} nights • {formatCurrency(item.pricePerNight || 0)} / night
                              </p>
                              {Array.isArray(item.amenities) && item.amenities.length > 0 && <p className="mt-2 text-xs text-[#5A6F68]">Amenities: {item.amenities.join(', ')}</p>}
                              {item.rating && item.rating > 0 && <p className="mt-1 text-xs text-[#5A6F68]">Rating: {item.rating}/5 ⭐</p>}
                              {item.nearAttractions && <p className="mt-1 text-xs text-[#5A6F68]">Near: {item.nearAttractions}</p>}
                              {item.bookingUrl && (
                                <a
                                  href={item.bookingUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-2 inline-flex text-xs font-semibold text-[#2E6358] underline decoration-[#2E6358]/40 underline-offset-2"
                                >
                                  Search & book
                                </a>
                              )}
                              {item.alternateBookingUrl && (
                                <a
                                  href={item.alternateBookingUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 inline-flex text-xs font-semibold text-[#5A6F68] underline decoration-[#5A6F68]/40 underline-offset-2"
                                >
                                  Alternate booking link
                                </a>
                              )}
                            </div>
                          )) : (
                            <p className="text-sm text-[#5A6F68]">No accommodation details available.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-[#EDE2D6] bg-white p-3">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[#152B24]">Weather</p>
                        <span className="text-[11px] uppercase tracking-[0.14em] text-[#5A6F68]">{weather.mode || 'Unknown'}</span>
                      </div>
                      <p className="text-sm text-[#2D3A35]">
                        {weather.location ? `${weather.location}: ` : ''}{weather.note || 'Weather details are not available.'}
                      </p>
                      {weather.days?.length ? (
                        <div className="mt-3 grid gap-2 md:grid-cols-3">
                          {weather.days.map((day) => (
                            <div key={day.date} className="rounded-xl bg-[#F9F7F4] p-2 text-xs text-[#5A6F68]">
                              <p className="font-semibold text-[#152B24]">{formatDayLabel(day.date)}</p>
                              <p>{day.condition || 'Forecast unavailable'}</p>
                              <p>
                                {day.tempMinC != null && day.tempMaxC != null
                                  ? `${day.tempMinC}°C - ${day.tempMaxC}°C`
                                  : 'Temperatures unavailable'}
                              </p>
                              {day.rainChancePercent != null && <p>Rain chance: {day.rainChancePercent}%</p>}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 rounded-2xl border border-[#EDE2D6] bg-white p-3">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[#152B24]">Travel plan</p>
                        <span className="text-xs text-[#5A6F68]">{travelDays.length} days</span>
                      </div>
                      <div className="space-y-4">
                        {travelDays.length ? travelDays.map((day) => (
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
                                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[#5A6F68]">
                                    {activity.entryFeePerPerson != null && <span>Entry: {formatCurrency(activity.entryFeePerPerson)}</span>}
                                    {activity.durationMinutes != null && <span>Duration: {activity.durationMinutes} mins</span>}
                                    {activity.travelFromPrevious && <span>From prev: {activity.travelFromPrevious}</span>}
                                    {activity.openingHours && <span>Open: {activity.openingHours}</span>}
                                    {typeof activity.indoor === 'boolean' && <span>{activity.indoor ? 'Indoor' : 'Outdoor'}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )) : (
                          <p className="text-sm text-[#5A6F68]">No day-by-day plan available yet.</p>
                        )}
                      </div>
                    </div>

                    {packingChecklist.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-[#EDE2D6] bg-white p-3">
                        <p className="text-sm font-semibold text-[#152B24]">Packing checklist</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#2D3A35]">
                          {packingChecklist.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {!expenses.withinBudget && (expenses.budgetWarning || expenses.possibleReductions?.length > 0) && (
                      <div className="mt-4 rounded-2xl border border-[#F1B7B1] bg-[#FFF2F0] p-3">
                        <p className="text-sm font-semibold text-[#7A2B2B]">Budget Alert</p>
                        {expenses.budgetWarning && <p className="mt-2 text-xs text-[#7A2B2B]">{expenses.budgetWarning}</p>}
                        {Array.isArray(expenses.possibleReductions) && expenses.possibleReductions.length > 0 && (
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#7A2B2B]">
                            {expenses.possibleReductions.map((reduction) => (
                              <li key={reduction}>{reduction}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {expenseItems.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-[#EDE2D6] bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[#152B24]">Budget breakdown</p>
                          <span className="text-xs text-[#5A6F68]">{formatCurrency(expenses.total || 0)} total</span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {expenseItems.map((item, index) => (
                            <div
                              key={`${item.category}-${index}`}
                              className="flex items-center justify-between gap-3 rounded-xl bg-[#F9F7F4] px-3 py-2"
                            >
                              <div>
                                <p className="text-sm font-medium text-[#152B24]">{item.description}</p>
                                <p className="text-[11px] text-[#5A6F68]">{item.category} {item.dataType === 'ESTIMATED' ? '(Estimated)' : ''}</p>
                              </div>
                              <span className="text-sm font-semibold text-[#152B24]">{formatCurrency(item.amount || 0)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-[#EDE2D6] bg-white p-3">
                        <p className="text-sm font-semibold text-[#152B24]">Preferences used</p>
                        <div className="mt-2 space-y-1 text-xs text-[#5A6F68]">
                          {Object.keys(preferenceValues).length ? Object.entries(preferenceValues).map(([key, value]) => (
                            <p key={key}><span className="font-medium text-[#152B24]">{key}:</span> {value || 'Not set'}</p>
                          )) : <p>No preferences recorded.</p>}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-[#EDE2D6] bg-white p-3">
                        <p className="text-sm font-semibold text-[#152B24]">Notes and sources</p>
                        <div className="mt-2 space-y-1 text-xs text-[#5A6F68]">
                          {Object.keys(preferenceSources).length ? Object.entries(preferenceSources).map(([key, value]) => (
                            <p key={key}><span className="font-medium text-[#152B24]">{key}:</span> {value || 'Unknown'}</p>
                          )) : <p>No source metadata.</p>}
                          {Object.keys(preferenceNotes).length ? Object.entries(preferenceNotes).map(([key, value]) => (
                            <p key={key}><span className="font-medium text-[#152B24]">{key}:</span> {value || '—'}</p>
                          )) : null}
                        </div>
                      </div>
                    </div>

                    {assumptions.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-[#D8E8E2] bg-[#F2FBF6] p-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#2E6358]">Assumptions</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#2D3A35]">
                          {assumptions.map((item) => (
                            <li key={item}>{item}</li>
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

                    {itinerary.dataNotice && (
                      <div className="mt-4 rounded-2xl border border-[#D8E8E2] bg-[#F2FBF6] p-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#2E6358]">Data Notice</p>
                        <p className="mt-2 text-xs leading-5 text-[#5A6F68]">{itinerary.dataNotice}</p>
                      </div>
                    )}
    </>
  );
}

function ItineraryCard({ itinerary, trip, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const s = itinerary?.tripSummary || {};
  const total = itinerary?.expenses?.total;
  return (
    <div className="overflow-hidden rounded-3xl border border-[#D9CFBE] bg-white">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 bg-[#FAF7F2] px-4 py-3 text-left">
        <span>
          <span className="block font-serif text-lg">{s.title || `${s.source || trip.source || 'Trip'} to ${s.destination || trip.destination || 'destination'}`}</span>
          <span className="block text-xs text-[#5A6F68]">
            {[s.days && `${s.days} days`, s.travelers && `${s.travelers} travellers`, total != null && `${formatCurrency(total)} estimated`].filter(Boolean).join(' • ')}
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-[#EFE6DC] bg-[#FAF7F2] p-4"><ItineraryPanel itinerary={itinerary} trip={trip} /></div>}
    </div>
  );
}

function Message({ m, trip, sending, onPlan, onTick }) {
  const [done, setDone] = useState(!m.fresh);
  const [copied, setCopied] = useState(false);
  if (m.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl bg-[#EFE6DC] px-4 py-2.5 text-[15px] leading-7">{m.content}</div>
      </div>
    );
  }
  const hasData = !!(m.itinerary || m.recommendations);
  const text = hasData ? (m.content || '').split('\n\n')[0] : m.content || '';
  const copy = async () => {
    await navigator.clipboard.writeText(m.content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="group flex gap-3">
      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F79041]">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className={`min-w-0 flex-1 space-y-4 text-[15px] leading-7 ${m.isError ? 'text-[#7A2B2B]' : ''}`}>
        {text && <Typed text={text} animate={!!m.fresh} onTick={onTick} onDone={() => setDone(true)} />}
        {!text && !done && setDone(true)}
        {done && m.recommendations && <RecsPanel recommendations={m.recommendations} onPlan={onPlan} sending={sending} />}
        {done && m.itinerary && <ItineraryCard itinerary={m.itinerary} trip={trip} defaultOpen={!!m.fresh} />}
        {done && m.content && (
          <button type="button" onClick={copy} aria-label="Copy reply"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-[#5A6F68] opacity-0 transition hover:bg-[#EFE6DC] focus:opacity-100 group-hover:opacity-100">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  'Suggest some beaches for November',
  'Mountain places under ₹20,000',
  'Plan Goa from Delhi, 2 people, 5 days, ₹30,000',
];


export default function ChatbotPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => localStorage.getItem('naaviToken'));
  const [trip, setTrip] = useState(defaultTrip);
  const [itinerary, setItinerary] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
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
  const abortRef = useRef(null);
  const taRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  useEffect(() => { if (!draft && taRef.current) taRef.current.style.height = 'auto'; }, [draft]);

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
          setMessages([]);
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
      setRecommendations(null);

      const chatMessages = (chatResponse.data || []).map((msg) => ({
        id: msg.id,
        role: msg.role === 'ASSISTANT' ? 'assistant' : 'user',
        content: msg.content,
      }));

      const combined = [...chatMessages];
      if (nextItinerary) combined.push({ id: `plan-${tripId}`, role: 'assistant', content: '', itinerary: nextItinerary });

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
  }, [messages, sending, loading]);

  const submitMessage = async (raw) => {
    const message = (raw || '').trim();
    if (!message || sending) return;

    setDraft('');
    setSending(true);
    setError('');
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: 'user', content: message }]);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const payload = selectedTripId ? { tripId: selectedTripId, message } : { message };
      const response = await axios.post(`${BASE_URL}/api/travel/plan`, payload, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
        timeout: 180000,
      });

      const resultTrip = sanitizeTrip(response.data?.trip || {});
      const nextTripId = resultTrip.id || response.data?.trip?.id || selectedTripId;
      const responseType = response.data?.type || '';
      const missingFields = response.data?.missingFields || [];

      if (nextTripId) {
        setSelectedTripId(nextTripId);
        setTrip(resultTrip);
        setHistory((current) => (current.some((item) => item.id === nextTripId)
          ? current.map((item) => (item.id === nextTripId ? { ...item, ...resultTrip, id: nextTripId } : item))
          : [{ ...resultTrip, id: nextTripId }, ...current]));
      }

      let messageContent = response.data?.reply || 'I have saved your request and I am ready to continue.';
      
      // For QUESTION type, append missing fields info to the message
      if (responseType === 'QUESTION' && missingFields.length > 0) {
        messageContent += `\n\n**Missing information:** ${missingFields.join(', ')}`;
      }

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          fresh: true,
          content: messageContent,
          recommendations: responseType === 'RECOMMENDATION' ? response.data?.recommendations ?? null : null,
          itinerary: responseType === 'ITINERARY' ? response.data?.itinerary ?? null : null,
          missingFields: responseType === 'QUESTION' ? missingFields : null,
        },
      ]);
    } catch (err) {
      if (axios.isCancel(err)) return;
      const apiMessage = err?.response?.data?.message || err?.response?.data?.error
        || (err?.code === 'ECONNABORTED' ? 'This is taking too long. Please try again.' : 'Unable to send your message.');
      setMessages((current) => [
        ...current,
        { id: `assistant-${Date.now()}`, role: 'assistant', isError: true, content: apiMessage },
      ]);
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    await submitMessage(draft.trim());
  };

  const handlePlanPlace = async (placeName) => {
    await submitMessage(`Plan a trip to ${placeName}`);
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
    setRecommendations(null);
    setMessages([]);
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

  const isEmpty = messages.length === 0;
  const scrollDown = () => bottomRef.current?.scrollIntoView({ block: 'end' });

  const composer = (
    <div className="mx-auto w-full max-w-3xl">
      {error && <div className="mb-2 rounded-2xl border border-[#F1B7B1] bg-[#FFF2F0] px-3 py-2 text-sm text-[#7A2B2B]">{error}</div>}
      <div className="flex items-end gap-2 rounded-3xl border border-[#D9CFBE] bg-white p-2.5 shadow-[0_8px_30px_rgba(21,43,36,0.08)] focus-within:border-[#F79041]">
        <textarea
          ref={taRef}
          rows={1}
          value={draft}
          aria-label="Message Naavi"
          onChange={(e) => {
            setDraft(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submitMessage(draft);
            }
          }}
          placeholder={selectedTripId ? 'Ask a question or change the plan' : 'Ask for ideas or plan a trip'}
          className="max-h-[200px] min-h-11 flex-1 resize-none border-0 bg-transparent px-3 py-2.5 text-[15px] text-[#152B24] placeholder:text-[#77857F] focus:outline-none"
        />
        {sending ? (
          <button type="button" onClick={() => abortRef.current?.abort()} aria-label="Stop"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#152B24] text-white">
            <Square className="h-4 w-4 fill-current" />
          </button>
        ) : (
          <button type="button" onClick={() => submitMessage(draft)} disabled={!draft.trim()} aria-label="Send message"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F79041] text-[#1A231F] transition hover:bg-[#E78339] disabled:cursor-not-allowed disabled:opacity-40">
            <ArrowUp className="h-5 w-5" />
          </button>
        )}
      </div>
      <p className="mt-2 text-center text-xs text-[#77857F]">Naavi can make mistakes. Confirm fares and availability before booking.</p>
    </div>
  );

  return (
    <div className="flex h-screen bg-cream text-[#152B24]">
      {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      {sidebarOpen && (
        <aside className="fixed inset-y-0 left-0 z-30 flex w-72 shrink-0 flex-col border-r border-[#EFE6DC] bg-[#F8F5F1] lg:static">
          <div className="flex items-center gap-2 px-4 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F79041]"><Compass className="h-4 w-4" /></div>
            <span className="font-serif text-xl">Naavi</span>
          </div>
          <div className="px-3">
            <button type="button" onClick={() => { handleNewTrip(); setSidebarOpen(window.innerWidth >= 1024); }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-[#EFE6DC]">
              <Plus className="h-4 w-4" /> New trip
            </button>
          </div>
          <p className="px-6 pb-1 pt-4 text-xs text-[#77857F]">Recent trips</p>
          <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Recent trips">
            {history.length === 0 && <p className="px-3 py-2 text-sm text-[#77857F]">Your trips will show up here.</p>}
            {history.map((item) => (
              <button key={item.id} type="button" onClick={() => { handleReuseTrip(item.id); setSidebarOpen(window.innerWidth >= 1024); }}
                className={`block w-full truncate rounded-xl px-3 py-2 text-left text-sm hover:bg-[#EFE6DC] ${item.id === selectedTripId ? 'bg-white shadow-sm' : ''}`}>
                {item.title || pathFromTrip(item)}
              </button>
            ))}
          </nav>
          <div className="border-t border-[#EFE6DC] p-3">
            <button type="button" onClick={() => navigate('/trips')}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-[#EFE6DC]">
              <MessageSquareText className="h-4 w-4" /> My trips
            </button>
          </div>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle sidebar"
              className="rounded-lg p-2 hover:bg-[#EFE6DC]"><PanelLeft className="h-5 w-5" /></button>
            <h1 className="truncate font-serif text-lg">{isEmpty ? 'New trip' : currentTripSummary}</h1>
          </div>
          {selectedTripId && (
            <div className="flex items-center gap-1">
              {copyState && <span className="mr-1 text-xs text-[#2E6358]">{copyState}</span>}
              <button type="button" onClick={handleShare} aria-label="Share trip" className="rounded-lg p-2 hover:bg-[#EFE6DC]"><Share2 className="h-5 w-5" /></button>
              <button type="button" onClick={handleDeleteTrip} aria-label="Delete trip" className="rounded-lg p-2 text-[#7A2B2B] hover:bg-[#FFF3F1]"><Trash2 className="h-5 w-5" /></button>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto">
          {isEmpty ? (
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center gap-6 px-4 pb-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F79041]"><Compass className="h-6 w-6" /></div>
              <h2 className="font-serif text-4xl">Where to next?</h2>
              {composer}
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => submitMessage(s)}
                    className="rounded-full border border-[#D9CFBE] bg-white px-4 py-2 text-sm hover:border-[#F79041]">{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl space-y-7 px-4 py-6">
              {messages.map((m) => (
                <Message key={m.id} m={m} trip={trip} sending={sending} onPlan={handlePlanPlace} onTick={scrollDown} />
              ))}
              {sending && (
                <div className="flex gap-3" role="status">
                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F79041]"><Sparkles className="h-4 w-4 animate-pulse" /></div>
                  <p className="animate-pulse pt-1 text-[15px] text-[#5A6F68]">Thinking… full itineraries can take up to a minute.</p>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {!isEmpty && <div className="px-4 pb-4 pt-2">{composer}</div>}
      </div>
    </div>
  );
}