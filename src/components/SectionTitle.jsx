import AppIcon from "./AppIcon.jsx";
import { styles } from "../app/styles.jsx";

export default function SectionTitle({ icon, label, color = "#962626" }) {
  return (
    <span style={styles.sectionTitle}>
      <span style={{ color, display: "inline-flex" }}>
        <AppIcon icon={icon} size={16} />
      </span>
      <span>{label}</span>
    </span>
  );
}
