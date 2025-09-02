"use client";

import { MediaProvider } from '@/app/contexts/mediaContext';
import { ReactNode } from 'react';

// This component will wrap all your client-side context providers
export function Providers({ children }: { children: ReactNode }) {
    return (
        <MediaProvider>
            {children}
        </MediaProvider>
    );
}