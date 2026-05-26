import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div
          className="pointer-events-none absolute inset-0 mesh-bg opacity-40"
          aria-hidden
        />
        <main className="relative flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:px-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
