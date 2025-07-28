import { Suspense } from 'react';
import ManageCompanyView from './ManageCompanyView';

export default function ManageCompanyPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ManageCompanyView />
    </Suspense>
  );
}