import { styles } from "../app/styles.jsx";

export default function Block({ title, children, right }) {
  return (
    <section style={styles.block} className="glassBlock">
      <div style={styles.blockTop}>
        <h2 style={styles.blockTitle}>{title}</h2>
        {right ? <div>{right}</div> : null}
      </div>
      <div>{children}</div>
    </section>
  );
}
