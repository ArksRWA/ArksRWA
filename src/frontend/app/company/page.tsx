import { Suspense } from 'react';
import CompanyDetailsPage from './CompanyDetailsPageClient';

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
          <div className="text-white">Loading company details...</div>
        </div>
      }
    >
      <CompanyDetailsPage />
    </Suspense>
  );
}
