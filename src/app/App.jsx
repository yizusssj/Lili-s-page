import { lazy, Suspense, useMemo, useState } from "react";
import { useAuth } from "../auth/authContext.js";
import Sidebar from "../components/Sidebar.jsx";
import SyncStatus from "../components/SyncStatus.jsx";
import Memories from "../pages/Memories.jsx";
import Notes from "../pages/Notes.jsx";
import Pinterest from "../pages/Pinterest.jsx";
import Tasks from "../pages/Tasks.jsx";
import Today from "../pages/Today.jsx";
import { PAGES } from "./config.js";
import { styles } from "./styles.jsx";

const Calendar = lazy(() => import("../pages/Calendar.jsx"));
const Arcade = lazy(() => import("../pages/Arcade.jsx"));

const PAGE_COMPONENTS = {
  today: Today,
  tasks: Tasks,
  calendar: Calendar,
  notes: Notes,
  memories: Memories,
  games: Arcade,
  pinterest: Pinterest,
};

export default function App() {
  const { signOut, user } = useAuth();
  const [active, setActive] = useState("today");
  const activePage = useMemo(() => PAGES.find((page) => page.id === active), [active]);
  const ActivePage = PAGE_COMPONENTS[active] ?? Today;

  return (
    <div style={styles.app} className="appShell">
      <Sidebar
        active={active}
        onNavigate={setActive}
        onSignOut={signOut}
        userEmail={user?.email}
      />

      <main style={styles.main}>
        {active !== "today" && (
          <header style={styles.header} className="appHeader">
            <div>
              <h1 style={styles.pageTitle}>{activePage?.name ?? "Página"}</h1>
              <div style={styles.pageSubtitle}>Organizador</div>
            </div>
          </header>
        )}

        <section style={styles.content} className="content">
          <SyncStatus />
          <Suspense fallback={<div className="pageLoading">Abriendo sección...</div>}>
            <ActivePage onNavigate={setActive} />
          </Suspense>
        </section>
      </main>
    </div>
  );
}
