import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  UtensilsCrossed,
  CarFront,
  Hotel,
  MapPinned,
  Footprints,
  HeartPulse,
  Sparkles,
} from 'lucide-react';

const BASE_URL = 'http://localhost:8080';

const initialForm = {
  foodPreference: '',
  localTravelPreference: '',
  accommodationPreference: '',
  travelStyle: '',
  transportationPreference: '',
  dietaryNotes: '',
  preferredActivities: '',
  walkingTolerance: '',
  accessibilityRequirements: '',
  preferredAccommodationArea: '',
  tripPace: '',
};

const enumOptions = {
  foodPreference: ['VEGETARIAN', 'NON_VEGETARIAN', 'VEGAN', 'JAIN', 'NO_PREFERENCE', 'OTHER'],
  localTravelPreference: ['PUBLIC_TRANSPORT', 'AUTO_RICKSHAW', 'CAB_TAXI', 'RENTAL_BIKE', 'RENTAL_CAR', 'WALKING', 'NO_PREFERENCE'],
  accommodationPreference: ['HOSTEL', 'BUDGET', 'MID_RANGE', 'PREMIUM', 'RESORT', 'HOMESTAY', 'NO_PREFERENCE'],
  transportationPreference: ['CHEAPEST', 'FASTEST', 'COMFORTABLE', 'TRAIN_PREFERRED', 'BUS_PREFERRED', 'FLIGHT_PREFERRED', 'NO_PREFERENCE'],
  travelStyle: ['BUDGET', 'BACKPACKING', 'RELAXED', 'ADVENTURE', 'FAMILY', 'COUPLE', 'LUXURY', 'CULTURAL', 'NATURE', 'RELIGIOUS'],
};

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

export default function PreferencesPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [hasExistingPreferences, setHasExistingPreferences] = useState(false);

  useEffect(() => {
    const fetchPreferences = async () => {
      const token = localStorage.getItem('naaviToken');

      if (!token) {
        navigate('/login', { replace: true });
        return;
      }

      try {
        const response = await axios.get(`${BASE_URL}/api/users/me/preferences`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        setHasExistingPreferences(true);
        setFormData((previous) => ({
          ...previous,
          ...response.data,
        }));

        if (hasRequiredPreferences(response.data)) {
          setSuccessMessage('Your preferences are already set. You can update them anytime.');
        }
      } catch (error) {
        if (error.response?.status !== 404) {
          setErrorMessage(
            error.response?.data?.message ||
              error.response?.data?.error ||
              'Unable to load your preferences.'
          );
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreferences();
  }, [navigate]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const token = localStorage.getItem('naaviToken');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    const requiredFields = [
      'foodPreference',
      'localTravelPreference',
      'accommodationPreference',
      'travelStyle',
      'transportationPreference',
    ];

    const missingField = requiredFields.find((field) => !formData[field]);
    if (missingField) {
      setErrorMessage('Please fill all required travel preferences.');
      return;
    }

    const payload = {
      ...formData,
      updatedAt: new Date().toISOString(),
    };

    try {
      setIsSaving(true);
      const method = hasExistingPreferences ? 'put' : 'post';
      await axios[method](`${BASE_URL}/api/users/me/preferences`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setSuccessMessage('Preferences saved successfully.');
      setHasExistingPreferences(true);

      setTimeout(() => {
        navigate('/', { replace: true });
      }, 700);
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          error.response?.data?.error ||
          'Unable to save your preferences.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const sections = [
    {
      key: 'foodPreference',
      label: 'Food preference',
      icon: UtensilsCrossed,
      helper: 'What best matches your dining style?',
      required: true,
      type: 'select',
    },
    {
      key: 'localTravelPreference',
      label: 'Local travel',
      icon: CarFront,
      helper: 'How do you want to move around locally?',
      required: true,
      type: 'select',
    },
    {
      key: 'accommodationPreference',
      label: 'Accommodation',
      icon: Hotel,
      helper: 'What kind of stay do you prefer?',
      required: true,
      type: 'select',
    },
    {
      key: 'travelStyle',
      label: 'Travel style',
      icon: Sparkles,
      helper: 'Pick the style that fits your trips best.',
      required: true,
      type: 'select',
    },
    {
      key: 'transportationPreference',
      label: 'Transportation',
      icon: MapPinned,
      helper: 'What matters most when moving between places?',
      required: true,
      type: 'select',
    },
    {
      key: 'tripPace',
      label: 'Trip pace',
      icon: Footprints,
      helper: 'Example: slow, balanced, or fast-paced',
      required: false,
      type: 'input',
    },
    {
      key: 'walkingTolerance',
      label: 'Walking tolerance',
      icon: Footprints,
      helper: 'How much walking feels comfortable?',
      required: false,
      type: 'input',
    },
    {
      key: 'dietaryNotes',
      label: 'Dietary notes',
      icon: HeartPulse,
      helper: 'Any food notes or restrictions to remember?',
      required: false,
      type: 'textarea',
    },
    {
      key: 'preferredActivities',
      label: 'Preferred activities',
      icon: Sparkles,
      helper: 'Museums, beaches, cafes, hiking, nightlife, and more.',
      required: false,
      type: 'textarea',
    },
    {
      key: 'accessibilityRequirements',
      label: 'Accessibility requirements',
      icon: HeartPulse,
      helper: 'Add mobility or access needs here.',
      required: false,
      type: 'textarea',
    },
    {
      key: 'preferredAccommodationArea',
      label: 'Preferred area',
      icon: MapPinned,
      helper: 'Example: city center, near beach, quiet neighborhood',
      required: false,
      type: 'input',
    },
  ];

  return (
    <div className="min-h-screen bg-cream px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center gap-3 text-[#152B24]">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F79041] text-[#152B24] shadow-sm">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5A6F68]">Naavi setup</p>
            <h1 className="font-serif text-3xl sm:text-4xl">Set your travel preferences first</h1>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="relative overflow-hidden rounded-4xl bg-[#152B24] p-8 text-white shadow-[0_30px_80px_rgba(21,43,36,0.18)]">
            <div className="absolute -left-20 top-4 h-44 w-44 rounded-full bg-[#F79041]/15 blur-3xl" />
            <div className="absolute -right-10 bottom-0 h-56 w-56 rounded-full bg-[#E6F2ED]/10 blur-3xl" />

            <div className="relative z-10 flex h-full flex-col justify-between gap-8">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D7E8E1]">Before anything else</p>
                <h2 className="mt-3 max-w-md font-serif text-4xl leading-tight text-[#F8F5F0]">We tailor the trip after we know your style.</h2>
                <p className="mt-4 max-w-md text-sm leading-6 text-[#CAD7D1]">
                  These preferences help Naavi build routes, stays, food options, and transport choices that match your travel rhythm.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  'Required travel defaults must be selected',
                  'Optional notes can be added or edited anytime',
                  'You only need to do this once before planning',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                    <CheckCircle2 className="h-5 w-5 text-[#F79041]" />
                    <span className="text-sm text-[#E9F3EE]">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="rounded-4xl border border-[#D9CFBE] bg-white p-6 shadow-[0_30px_80px_rgba(21,43,36,0.12)] sm:p-8">
            {isLoading ? (
              <div className="flex min-h-105 items-center justify-center text-[#5A6F68]">Loading preferences...</div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  {sections.map((field) => {
                    const Icon = field.icon;
                    const baseLabel = (
                      <div className="mb-2 flex items-center gap-2">
                        <Icon className="h-4 w-4 text-[#3A7563]" />
                        <span className="text-sm font-semibold text-[#2D3A35]">{field.label}</span>
                        {field.required && <span className="text-[#C06D40]">*</span>}
                      </div>
                    );

                    return (
                      <div key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                        <label className="block">
                          {baseLabel}
                          <p className="mb-2 text-xs text-[#6F7E78]">{field.helper}</p>
                          {field.type === 'select' ? (
                            <select
                              name={field.key}
                              value={formData[field.key]}
                              onChange={handleChange}
                              className="w-full rounded-2xl border border-[#D9CFBE] bg-[#F9F5F1] px-4 py-3 text-sm text-[#1E2E29] outline-none transition focus:border-[#152B24] focus:ring-2 focus:ring-[#D9E9E2]"
                            >
                              <option value="">Select an option</option>
                              {enumOptions[field.key].map((option) => (
                                <option key={option} value={option}>
                                  {option.replaceAll('_', ' ')}
                                </option>
                              ))}
                            </select>
                          ) : field.type === 'textarea' ? (
                            <textarea
                              name={field.key}
                              value={formData[field.key]}
                              onChange={handleChange}
                              rows="4"
                              className="w-full rounded-2xl border border-[#D9CFBE] bg-[#F9F5F1] px-4 py-3 text-sm text-[#1E2E29] outline-none transition placeholder:text-[#77857F] focus:border-[#152B24] focus:ring-2 focus:ring-[#D9E9E2]"
                              placeholder="Add details here"
                            />
                          ) : (
                            <input
                              type="text"
                              name={field.key}
                              value={formData[field.key]}
                              onChange={handleChange}
                              className="w-full rounded-2xl border border-[#D9CFBE] bg-[#F9F5F1] px-4 py-3 text-sm text-[#1E2E29] outline-none transition placeholder:text-[#77857F] focus:border-[#152B24] focus:ring-2 focus:ring-[#D9E9E2]"
                              placeholder="Add details here"
                            />
                          )}
                        </label>
                      </div>
                    );
                  })}
                </div>

                {errorMessage && (
                  <div className="rounded-2xl border border-[#F1B7B1] bg-[#FFF2F0] px-4 py-3 text-sm text-[#7A2B2B]">
                    {errorMessage}
                  </div>
                )}

                {successMessage && (
                  <div className="rounded-2xl border border-[#A7D6BA] bg-[#EBF7EF] px-4 py-3 text-sm text-[#1B4D3A]">
                    {successMessage}
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-[#5A6F68]">
                    Required preferences are marked with <span className="text-[#C06D40]">*</span>
                  </p>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#F79041] px-6 py-3 text-sm font-semibold text-[#1A231F] transition hover:bg-[#E78339] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSaving ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#1A231F] border-t-transparent" />
                        Saving preferences...
                      </>
                    ) : (
                      <>
                        <span>{hasExistingPreferences ? 'Update preferences' : 'Save preferences'}</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
