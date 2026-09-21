import React, { useState } from 'react';
import { login, register } from '../services/apiClient';

export default function AuthScreen({ onAuthenticated }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = isRegistering
        ? await register(form.name, form.email, form.password)
        : await login(form.email, form.password);
      onAuthenticated(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0b132b] flex items-center justify-center p-6 text-white">
      <form onSubmit={submit} className="w-full max-w-md bg-[#111827] border border-slate-700 rounded-2xl p-8 shadow-2xl space-y-5">
        <div><p className="text-blue-400 text-xs uppercase tracking-widest font-bold">UrbanTwin</p><h1 className="text-2xl font-bold mt-2">{isRegistering ? 'Create your account' : 'Sign in to your dashboard'}</h1></div>
        {isRegistering && <input required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm" />}
        <input required type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm" />
        <input required minLength={6} type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm" />
        {error && <p className="text-rose-400 text-sm">{error}</p>}
        <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg p-3 font-bold text-sm">{loading ? 'Please wait…' : isRegistering ? 'Create account' : 'Sign in'}</button>
        <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="w-full text-slate-400 hover:text-white text-sm">{isRegistering ? 'Already have an account? Sign in' : 'New user? Create an account'}</button>
      </form>
    </main>
  );
}
