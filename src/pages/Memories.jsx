import { Camera } from "lucide-react";
import { styles } from "../app/styles.jsx";
import Block from "../components/Block.jsx";
import SectionTitle from "../components/SectionTitle.jsx";

export default function Memories() {
  return (
    <div style={styles.stack}>
      <Block title={<SectionTitle icon={Camera} label="Recuerdos" color="#7e22ce" />}>
        <div style={styles.p}>Después metere para subir fotos y escribirte una minicarta.</div>
      </Block>
    </div>
  );
}
