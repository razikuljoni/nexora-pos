'use client';

import React, { useState } from 'react';
import { UserPlus, Search, User, Award, X, Check } from 'lucide-react';
import type { Customer } from '@/lib/types';
import { db } from '@/lib/db';
import { sound } from '@/lib/audio';

interface CustomerSelectModalProps {
  isOpen: boolean;
  customers: Customer[];
  selectedCustomerId?: string;
  onSelectCustomer: (customer: Customer | undefined) => void;
  onCustomerCreated: (newCustomer: Customer) => void;
  onClose: () => void;
}

export const CustomerSelectModal: React.FC<CustomerSelectModalProps> = ({
  isOpen,
  customers,
  selectedCustomerId,
  onSelectCustomer,
  onCustomerCreated,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  if (!isOpen) return null;

  const filtered = customers.filter(
    c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    sound.playClick();
    const newCust: Customer = {
      id: `cust_${Date.now()}`,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      points: 25, // welcome bonus points!
      totalSpent: 0,
      visitCount: 0,
      tier: 'REGULAR',
      createdAt: new Date().toISOString(),
    };

    await db.customers.add(newCust);
    onCustomerCreated(newCust);
    onSelectCustomer(newCust);
    setIsCreating(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Attach Customer Account</h2>
              <p className="text-xs text-slate-400">Earn loyalty points & apply profile pricing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {selectedCustomerId && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
              <span className="text-emerald-300">Customer attached to this checkout</span>
              <button
                onClick={() => {
                  sound.playClick();
                  onSelectCustomer(undefined);
                }}
                className="text-rose-400 hover:underline font-semibold"
              >
                Detach (Walk-in)
              </button>
            </div>
          )}

          {!isCreating ? (
            <>
              {/* Search & New customer button */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name, phone or email..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
                  />
                </div>
                <button
                  onClick={() => setIsCreating(true)}
                  className="px-3.5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <UserPlus className="w-4 h-4" /> New
                </button>
              </div>

              {/* Customer List */}
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {filtered.map(cust => {
                  const isSelected = cust.id === selectedCustomerId;
                  return (
                    <div
                      key={cust.id}
                      onClick={() => {
                        sound.playClick();
                        onSelectCustomer(cust);
                        onClose();
                      }}
                      className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition ${
                        isSelected
                          ? 'bg-sky-500/20 border-sky-500 text-white'
                          : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-xs text-white flex items-center gap-2">
                          <span>{cust.name}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300">
                            {cust.tier}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {cust.phone} {cust.email ? `• ${cust.email}` : ''}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-amber-400 flex items-center justify-end gap-1">
                          <Award className="w-3.5 h-3.5" />
                          {cust.points} pts
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {cust.visitCount} visits • ${cust.totalSpent.toFixed(0)} spent
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Create Customer Form */
            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Jordan Hayes"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="e.g. +1 (415) 555-0144"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="e.g. jordan@example.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 text-xs"
                >
                  Back to Search
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Save & Attach
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
