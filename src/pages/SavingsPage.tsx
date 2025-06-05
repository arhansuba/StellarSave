// src/pages/SavingsPage.tsx
// Main Savings Page Wrapper for StellarSave

import React, { useEffect } from 'react';
import SavingsDashboard from '../components/Savings/SavingsDashboard';
import { useSavingsStore } from '../store/useSavingsStore';

// Assuming we have access to user state from the SEP wallet
// This would typically come from a context or global state
interface SavingsPageProps {
  userAccountPublicKey?: string;
}

const SavingsPage: React.FC<SavingsPageProps> = ({ userAccountPublicKey }) => {
  const { cleanup } = useSavingsStore();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Set page title
  useEffect(() => {
    document.title = userAccountPublicKey 
      ? 'StellarSave - Your Savings Dashboard'
      : 'StellarSave - Social Savings on Stellar';
  }, [userAccountPublicKey]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Optional: Breadcrumb or navigation */}
      {userAccountPublicKey && (
        <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center space-x-2 py-3 text-sm text-gray-600">
              <a href="/" className="hover:text-gray-900 transition-colors">
                Wallet
              </a>
              <span>→</span>
              <span className="font-medium text-gray-900">Savings</span>
            </div>
          </div>
        </nav>
      )}

      {/* Main Dashboard */}
      <SavingsDashboard userAccountPublicKey={userAccountPublicKey} />
    </div>
  );
};

// For easier integration with existing routing systems
export default SavingsPage;