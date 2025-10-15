'use client';

import { usePathname } from 'next/navigation';
import Navigation from './Navigation';

interface LayoutWrapperProps {
  children: React.ReactNode;
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname();
  
  // Don't show Navigation on home page since it has its own header
  const isHomePage = pathname === '/';
  
  return (
    <>
      {!isHomePage && <Navigation />}
      <main>
        {children}
      </main>
    </>
  );
}