'use client';

import { useState } from 'react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginAsUser: () => void;
  onLoginAsCompany: () => void;
  isConnecting: boolean;
  context?: 'company-view' | 'general';
}

export default function LoginModal({
  isOpen,
  onClose,
  onLoginAsUser,
  onLoginAsCompany,
  isConnecting,
  context = 'general'
}: LoginModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 min-h-screen">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.85) 0%, rgba(17, 24, 39, 0.9) 50%, rgba(0, 0, 0, 0.85) 100%)',
          zIndex: 1
        }}
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative backdrop-blur-xl rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
           style={{
             background: 'rgba(17, 24, 39, 0.95)',
             border: '1px solid rgba(75, 85, 99, 0.5)',
             boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
             zIndex: 2
           }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          disabled={isConnecting}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-green-600/20 to-green-700/20 rounded-lg flex items-center justify-center mx-auto mb-4">
            {context === 'company-view' ? (
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">
            {context === 'company-view' ? 'Connect to View Company Details' : 'Choose Login Type'}
          </h3>
          <p className="text-gray-400">
            {context === 'company-view'
              ? 'Connect your wallet to explore company details, view pricing, and start investing'
              : 'Select how you want to access the platform'
            }
          </p>
        </div>

        {/* Login Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Login as User */}
          <button
            onClick={onLoginAsUser}
            disabled={isConnecting}
            className="p-6 bg-gray-800 border border-gray-600 rounded-lg hover:border-primary/50 hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-500/30 transition-colors">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h4 className="text-xl font-semibold text-white mb-2">Login as User</h4>
              <p className="text-sm text-gray-400">
                {context === 'company-view'
                  ? 'View company details and invest in tokens'
                  : 'Browse and invest in tokenized companies'
                }
              </p>
            </div>
          </button>

          {/* Login as Company */}
          <button
            onClick={onLoginAsCompany}
            disabled={isConnecting}
            className="p-6 bg-gray-800 border border-gray-600 rounded-lg hover:border-primary/50 hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="text-center">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-green-500/30 transition-colors">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h4 className="text-xl font-semibold text-white mb-2">Login as Company</h4>
              <p className="text-sm text-gray-400">
                {context === 'company-view'
                  ? 'Access company management dashboard'
                  : 'Create and manage your tokenized company'
                }
              </p>
            </div>
          </button>
        </div>

        {/* Loading State */}
        {isConnecting && (
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 text-primary">
              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Connecting...</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-700">
          <p className="text-xs text-white-500 text-center">
            By connecting, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
