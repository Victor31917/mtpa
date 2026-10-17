
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import MobileNavigation from "../components/MobileNavigation";
import "./DashboardLayout.css";

export default function DashboardLayout() {
  return (
    <div className="dashboard-layout">
      <aside className="dashboard-layout__sidebar">
        <Sidebar />
      </aside>

      <div className="dashboard-layout__mobile-navigation">
        <MobileNavigation />
      </div>

      <main className="dashboard-layout__content" id="main-content">
        <Outlet />
      </main>
    </div>
  );
}
