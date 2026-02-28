import { Link, Outlet } from "@tanstack/react-router";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <nav className="flex items-center gap-4 p-3 border-b border-gray-800">
        <h1 className="font-semibold">Notetaker</h1>
        <Link to="/" className="text-sm text-gray-400 hover:text-gray-200 [&.active]:text-white">
          Recordings
        </Link>
        <Link to="/settings" className="text-sm text-gray-400 hover:text-gray-200 [&.active]:text-white">
          Settings
        </Link>
      </nav>
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}
