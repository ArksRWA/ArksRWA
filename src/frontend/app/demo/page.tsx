'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '../../services/auth';

export default function DemoPage() {
  const router = useRouter();

  useEffect(() => {
    const connectDemo = async () => {
      try {
        // Create a demo user directly
        const demoUser = {
          principal: "demo-user-" + Math.random().toString(36).substring(2, 11),
          isConnected: true,
          walletType: 'demo' as const
        };

        // Set the demo user in auth service
        (authService as any).currentUser = demoUser;
        
        // Redirect to companies page
        router.push('/companies');
      } catch (error) {
        console.error('Demo mode setup failed:', error);
        router.push('/');
      }
    };

    connectDemo();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <div className="text-white text-lg">Setting up demo mode...</div>
        <div className="text-gray-400 text-sm mt-2">You'll be redirected to the companies page</div>
      </div>
    </div>
  );
}