import TopNav from "../components/layout/TopNav";
import { Outlet } from "react-router-dom";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-brand-gray">
      <TopNav />
      {/* Le header est sticky h-12 → on laisse de l'espace en haut */}
      <main className="pt-12 px-4">
        <div className="w-[92vw] max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
