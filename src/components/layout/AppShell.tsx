import { Outlet } from 'react-router-dom';
import { Header } from './Header';

export function AppShell() {
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <Header />
      <main className="flex-1 px-4 py-4 pb-8 safe-area-bottom max-w-lg mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
