import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  Compass,
  User,
  Mail,
  Phone,
  Check,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

const BASE_URL = 'http://localhost:8080';

const enumOptions = {
  foodPreference: ['VEGETARIAN', 'NON_VEGETARIAN', 'VEGAN', 'JAIN', 'NO_PREFERENCE', 'OTHER'],
  localTravelPreference: ['PUBLIC_TRANSPORT', 'AUTO_RICKSHAW', 'CAB_TAXI', 'RENTAL_BIKE', 'RENTAL_CAR', 'WALKING', 'NO_PREFERENCE'],
  accommodationPreference: ['HOSTEL', 'BUDGET', 'MID_RANGE', 'PREMIUM', 'RESORT', 'HOMESTAY', 'NO_PREFERENCE'],
  transportationPreference: ['CHEAPEST', 'FASTEST', 'COMFORTABLE', 'TRAIN_PREFERRED', 'BUS_PREFERRED', 'FLIGHT_PREFERRED', 'NO_PREFERENCE'],
  travelStyle: ['BUDGET', 'BACKPACKING', 'RELAXED', 'ADVENTURE', 'FAMILY', 'COUPLE', 'LUXURY', 'CULTURAL', 'NATURE', 'RELIGIOUS'],
};

const initialPrefs = {
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

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [prefs, setPrefs] = useState(initialPrefs);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      const token = localStorage.getItem('naaviToken');
      if (!token) {
        navigate('/login', { replace: true });
        return;
      }

      try {
        setLoading(true);
        const [userRes, prefsRes] = await Promise.all([
          axios.get(`${BASE_URL}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${BASE_URL}/api/users/me/preferences`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        setUser(userRes.data || null);
        setPrefs((p) => ({ ...p, ...(prefsRes.data || {}) }));
      } catch (err) {
        const st = err?.response?.status;
        if (st === 401) {
          localStorage.removeItem('naaviToken');
          localStorage.removeItem('naaviUser');
          navigate('/login', { replace: true });
          return;
        }

        if (err?.response?.status === 404) {
          // no prefs yet
          setPrefs(initialPrefs);
        } else {
          setError('Unable to load profile.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setPrefs((p) => ({ ...p, [name]: value }));
    setError('');
    setSuccess('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const token = localStorage.getItem('naaviToken');
    if (!token) return navigate('/login', { replace: true });

    // require certain fields as in preferences flow
    const requiredFields = ['foodPreference', 'localTravelPreference', 'accommodationPreference', 'travelStyle', 'transportationPreference'];
    const missing = requiredFields.find((f) => !prefs[f]);
    if (missing) {
      setError('Please fill all required preferences before saving.');
      return;
    }

    try {
      setSaving(true);
      await axios.put(`${BASE_URL}/api/users/me/preferences`, { ...prefs, updatedAt: new Date().toISOString() }, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess('Preferences updated.');
      setEditing(false);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to update preferences.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading profile...</div>;
  }

  return (
    <div className="min-h-screen bg-cream px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center gap-3 text-[#152B24]">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F79041] text-[#152B24] shadow-sm">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5A6F68]">Profile</p>
            <h1 className="font-serif text-3xl sm:text-4xl">Your account</h1>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="rounded-4xl border border-[#D9CFBE] bg-white p-6 shadow-[0_20px_60px_rgba(21,43,36,0.08)]">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-[#F2F0EE] flex items-center justify-center text-3xl text-[#49655C]">
                {user?.profilePictureUrl ? (
                  <img src={user.profilePictureUrl} alt={user.name} className="h-full w-full object-cover" />
                ) : (
                  <User className="h-8 w-8" />
                )}
              </div>

              <div>
                <h2 className="text-xl font-semibold text-[#152B24]">{user?.name}</h2>
                <p className="text-sm text-[#5A6F68]">Member since {new Date(user?.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-[#49655C]" />
                <span className="text-sm text-[#27342F]">{user?.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-[#49655C]" />
                <span className="text-sm text-[#27342F]">{user?.phone || '—'}</span>
              </div>
            </div>
          </aside>

          <section className="rounded-4xl border border-[#D9CFBE] bg-white p-6 shadow-[0_20px_60px_rgba(21,43,36,0.08)]">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#152B24]">Travel preferences</h3>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditing((s) => !s)}
                  className="rounded-full border border-[#D9CFBE] bg-transparent px-3 py-2 text-sm text-[#1F2C28]"
                >
                  {editing ? 'Cancel' : 'Edit preferences'}
                </button>
              </div>
            </div>

            {error && <div className="mt-4 rounded-2xl border border-[#F1B7B1] bg-[#FFF2F0] px-4 py-3 text-sm text-[#7A2B2B]">{error}</div>}
            {success && <div className="mt-4 rounded-2xl border border-[#A7D6BA] bg-[#EBF7EF] px-4 py-3 text-sm text-[#1B4D3A]">{success}</div>}

            <form onSubmit={handleSave} className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { key: 'foodPreference', label: 'Food preference', required: true },
                  { key: 'localTravelPreference', label: 'Local travel', required: true },
                  { key: 'accommodationPreference', label: 'Accommodation', required: true },
                  { key: 'travelStyle', label: 'Travel style', required: true },
                  { key: 'transportationPreference', label: 'Transportation', required: true },
                  { key: 'tripPace', label: 'Trip pace', required: false },
                  { key: 'walkingTolerance', label: 'Walking tolerance', required: false },
                  { key: 'dietaryNotes', label: 'Dietary notes', required: false },
                  { key: 'preferredActivities', label: 'Preferred activities', required: false },
                ].map((f) => (
                  <div key={f.key} className={['dietaryNotes', 'preferredActivities'].includes(f.key) ? 'md:col-span-2' : ''}>
                    <label className="block">
                      <div className="mb-2 flex items-center gap-2">
                        <Check className="h-4 w-4 text-[#3A7563]" />
                        <span className="text-sm font-semibold text-[#2D3A35]">{f.label}{f.required ? ' *' : ''}</span>
                      </div>

                      {['foodPreference', 'localTravelPreference', 'accommodationPreference', 'transportationPreference', 'travelStyle'].includes(f.key) ? (
                        <select
                          name={f.key}
                          value={prefs[f.key] || ''}
                          onChange={handleChange}
                          disabled={!editing}
                          className="w-full rounded-2xl border border-[#D9CFBE] bg-[#F9F5F1] px-4 py-3 text-sm text-[#1E2E29] outline-none transition focus:border-[#152B24] focus:ring-2 focus:ring-[#D9E9E2]"
                        >
                          <option value="">Not set</option>
                          {(enumOptions[f.key] || []).map((opt) => (
                            <option key={opt} value={opt}>{opt.replaceAll('_', ' ')}</option>
                          ))}
                        </select>
                      ) : f.key === 'dietaryNotes' || f.key === 'preferredActivities' ? (
                        <textarea
                          name={f.key}
                          value={prefs[f.key] || ''}
                          onChange={handleChange}
                          disabled={!editing}
                          rows={3}
                          className="w-full rounded-2xl border border-[#D9CFBE] bg-[#F9F5F1] px-4 py-3 text-sm text-[#1E2E29] outline-none transition placeholder:text-[#77857F] focus:border-[#152B24] focus:ring-2 focus:ring-[#D9E9E2]"
                        />
                      ) : (
                        <input
                          type="text"
                          name={f.key}
                          value={prefs[f.key] || ''}
                          onChange={handleChange}
                          disabled={!editing}
                          className="w-full rounded-2xl border border-[#D9CFBE] bg-[#F9F5F1] px-4 py-3 text-sm text-[#1E2E29] outline-none transition placeholder:text-[#77857F] focus:border-[#152B24] focus:ring-2 focus:ring-[#D9E9E2]"
                        />
                      )}
                    </label>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3">
                {editing && (
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-full bg-[#F79041] px-6 py-3 text-sm font-semibold text-[#1A231F] transition hover:bg-[#E78339] disabled:opacity-70"
                  >
                    {saving ? 'Saving...' : 'Save preferences'}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
