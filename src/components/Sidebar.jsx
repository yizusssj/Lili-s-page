import { Heart, LogOut } from "lucide-react";
import { BRAND_IMAGE, PAGES } from "../app/config.js";
import { styles } from "../app/styles.jsx";
import AppIcon from "./AppIcon.jsx";
import ReminderCenter from "./ReminderCenter.jsx";

export default function Sidebar({ active, onNavigate, onSignOut, userEmail }) {
  return (
    <aside style={styles.sidebar} className="sidebar">
      <div style={styles.brand} className="brandPanel">
        <div style={styles.brandIcon} className="brandIcon">
          <span style={{ color: "#be123c", display: "inline-flex" }}>
            <AppIcon icon={Heart} imageSrc={BRAND_IMAGE} size={19} strokeWidth={1.7} />
          </span>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={styles.brandTitle}>Workspace</div>
          <div style={styles.brandSub}>de lili</div>
        </div>
        <div className="brandActions">
          <ReminderCenter />
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="glassIconButton logoutButton"
            style={{ ...styles.iconBtn, flexShrink: 0 }}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut aria-hidden="true" size={16} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <nav style={styles.nav} aria-label="Navegación principal">
        {PAGES.map((page) => {
          const isActive = page.id === active;
          const iconColor = isActive ? "var(--accent-text)" : page.color;
          return (
            <button
              type="button"
              key={page.id}
              onClick={() => onNavigate(page.id)}
              aria-current={isActive ? "page" : undefined}
              className={`navItem${isActive ? " navItemActive" : ""}`}
              style={{ ...styles.navItem, ...(isActive ? styles.navItemActive : {}) }}
            >
              <span style={{ ...styles.navIcon, color: iconColor }}>
                <AppIcon icon={page.icon} imageSrc={page.imageSrc} size={17} />
              </span>
              <span>{page.name}</span>
            </button>
          );
        })}
      </nav>

      <div style={styles.sidebarFooter} className="sidebarFooter">
        <div style={styles.tipTitle}>Sesión privada</div>
        <div style={styles.tipText} className="accountEmail" title={userEmail}>
          {userEmail ?? "Cuenta conectada"}
        </div>
      </div>
    </aside>
  );
}
