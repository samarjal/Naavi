import React, { useState } from 'react';
import axios from 'axios';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Compass,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  Sparkles,
  User,
} from 'lucide-react';

const BASE_URL = 'http://localhost:8080';

export default function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const isLoginPage = location.pathname === '/login';

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    profilePictureUrl: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    setErrorMessage('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');

    const email = formData.email.trim();
    const password = formData.password.trim();
    const name = formData.name.trim();

    if (!email) {
      setErrorMessage('Email is required.');
      return;
    }

    if (!password && isLoginPage) {
      setErrorMessage('Password is required to login.');
      return;
    }

    if (!isLoginPage && !name) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    const payload = { email };

    if (isLoginPage) {
      payload.password = password;
    } else {
      payload.name = name;
      if (password) payload.password = password;
      if (formData.phone.trim()) payload.phone = formData.phone.trim();
      if (formData.profilePictureUrl.trim()) payload.profilePictureUrl = formData.profilePictureUrl.trim();
    }

    try {
      setIsSubmitting(true);
      const response = await axios.post(`${BASE_URL}/api/auth/${isLoginPage ? 'login' : 'signup'}`, payload);
      const token = response.data?.token || response.data?.accessToken || response.data?.data?.token || response.data?.data?.accessToken;

      if (!token) {
        throw new Error('Authentication succeeded but no token was returned.');
      }

      localStorage.setItem('naaviToken', token);
      const user = response.data?.user || response.data?.data?.user || {
        name: name || response.data?.name || email,
        email,
      };
      localStorage.setItem('naaviUser', JSON.stringify(user));

      navigate('/preferences', { replace: true });
    } catch (error) {
      const apiMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.response?.data?.details ||
        error.message ||
        'Unable to complete authentication.';

      setErrorMessage(apiMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <div className="w-full overflow-hidden rounded-4xl border border-[#D9CFBE] bg-white shadow-[0_35px_90px_rgba(21,43,36,0.15)]">
          <div className="grid min-h-180 md:grid-cols-[1.1fr_0.9fr]">
            <div className="bg-cream p-6 sm:p-8 lg:p-10">
              <div className="mb-8 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F79041] text-[#152B24] shadow-sm">
                  <Compass className="h-5 w-5" />
                </div>
                <span className="text-lg font-semibold tracking-tight text-[#152B24]">Naavi</span>
              </div>

              <div className="mb-8">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#5A6F68]">
                  {isLoginPage ? 'Welcome back' : 'Start planning'}
                </p>
                <h1 className="font-serif text-4xl leading-tight text-[#152B24] sm:text-5xl">
                  {isLoginPage ? 'Welcome back!' : 'Get started.'}
                </h1>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLoginPage && (
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[#2D3A35]">Full name</span>
                    <div className="flex items-center gap-3 rounded-2xl border border-[#D9CFBE] bg-white px-3 py-3 shadow-sm focus-within:border-[#152B24] focus-within:ring-2 focus-within:ring-[#D9E9E2]">
                      <User className="h-4 w-4 text-[#49655C]" />
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Yaman Test"
                        className="w-full bg-transparent text-sm text-[#1E2E29] placeholder:text-[#77857F] focus:outline-none"
                      />
                    </div>
                  </label>
                )}

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#2D3A35]">Email</span>
                  <div className="flex items-center gap-3 rounded-2xl border border-[#D9CFBE] bg-white px-3 py-3 shadow-sm focus-within:border-[#152B24] focus-within:ring-2 focus-within:ring-[#D9E9E2]">
                    <Mail className="h-4 w-4 text-[#49655C]" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="hello@example.com"
                      className="w-full bg-transparent text-sm text-[#1E2E29] placeholder:text-[#77857F] focus:outline-none"
                    />
                  </div>
                </label>

                {!isLoginPage && (
                  <>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-[#2D3A35]">Phone (optional)</span>
                      <div className="flex items-center gap-3 rounded-2xl border border-[#D9CFBE] bg-white px-3 py-3 shadow-sm focus-within:border-[#152B24] focus-within:ring-2 focus-within:ring-[#D9E9E2]">
                        <Phone className="h-4 w-4 text-[#49655C]" />
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          placeholder="9876543210"
                          className="w-full bg-transparent text-sm text-[#1E2E29] placeholder:text-[#77857F] focus:outline-none"
                        />
                      </div>
                    </label>

    
                  </>
                )}

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#2D3A35]">Password</span>
                  <div className="flex items-center gap-3 rounded-2xl border border-[#D9CFBE] bg-white px-3 py-3 shadow-sm focus-within:border-[#152B24] focus-within:ring-2 focus-within:ring-[#D9E9E2]">
                    <Lock className="h-4 w-4 text-[#49655C]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder={isLoginPage ? 'Enter your password' : 'Create a secure password'}
                      className="w-full bg-transparent text-sm text-[#1E2E29] placeholder:text-[#77857F] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((previous) => !previous)}
                      className="text-[#49655C] transition hover:text-[#152B24]"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>

                {errorMessage && (
                  <div className="rounded-2xl border border-[#F1B7B1] bg-[#FFF2F0] px-3 py-2 text-sm text-[#7A2B2B]">
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[#F79041] px-5 py-3 text-sm font-semibold text-[#1A231F] transition hover:bg-[#E78339] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#1A231F] border-t-transparent" />
                      {isLoginPage ? 'Logging in...' : 'Creating account...'}
                    </>
                  ) : (
                    <>
                      <span>{isLoginPage ? 'Log in' : 'Sign up'}</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-[#425B55]">
                {isLoginPage ? "Need an account? " : 'Already have an account? '}
                <Link
                  to={isLoginPage ? '/signup' : '/login'}
                  className="font-semibold text-forest underline-offset-4 hover:underline"
                >
                  {isLoginPage ? 'Create one' : 'Log in'}
                </Link>
              </p>
            </div>

            <div className="relative overflow-hidden bg-[#152B24] p-6 sm:p-8 lg:p-10 text-white">
              <div className="absolute -left-10 top-6 h-40 w-40 rounded-full bg-[#F79041]/15 blur-3xl" />
              <div className="absolute -right-10 bottom-10 h-44 w-44 rounded-full bg-[#E6F2ED]/10 blur-3xl" />

              <div className="relative z-10 flex h-full flex-col justify-between">
                <div className="flex items-center gap-3 text-sm text-[#E3DFD7]">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F79041] text-[#152B24]">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  {isLoginPage ? 'Plan smarter' : 'Travel with intention'}
                </div>

                <div>
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#D7E8E1]">
                    {isLoginPage ? 'Welcome back' : 'Get started'}
                  </p>
                  <h2 className="max-w-md font-serif text-4xl leading-none text-[#F8F5F0] sm:text-5xl">
                    {isLoginPage ? 'Continue your next trip.' : 'Build your next great escape.'}
                  </h2>
                </div>

                <div className="space-y-4">
                  {[
                    'Plan city by city with thoughtful pacing',
                    'Save favorites and custom day-by-day routes',
                    'Sync travel ideas into a polished itinerary',
                  ].map((point) => (
                    <div key={point} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
                      <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#F79041] text-[#152B24]">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-sm text-[#E9F3EE]">{point}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-between rounded-[20px] border border-[#D5EDE4]/20 bg-cream p-4 text-[#152B24] shadow-sm">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5A6F68]">Ready to explore</p>
                    <p className="mt-1 text-lg font-semibold">Your next route starts here.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(isLoginPage ? '/signup' : '/login')}
                    className="rounded-full bg-[#F79041] px-4 py-2 text-sm font-semibold text-[#1A231F] transition hover:bg-[#E78339]"
                  >
                    {isLoginPage ? 'Sign up' : 'Log in'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
