import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { MaintenanceGate } from '@/features/maintenance/MaintenanceGate';
import { queryClient } from '@/lib/query-client';
import { router } from '@/routes';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MaintenanceGate>
        <RouterProvider router={router} />
      </MaintenanceGate>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: 'Inter, sans-serif',
            borderRadius: '12px',
          },
        }}
      />
    </QueryClientProvider>
  );
}

export default App;
