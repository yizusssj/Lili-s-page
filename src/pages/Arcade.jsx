import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  CircleDot,
  Gamepad2,
  Grid3X3,
  Lock,
  MoonStar,
  Sparkles,
  Trophy,
  Waves,
  WifiOff,
} from "lucide-react";
import FallingBlocks from "../games/FallingBlocks.jsx";
import SandGame from "../games/SandGame.jsx";

const GAMES = [
  {
    accent: "#61d9e8",
    description: "Las piezas se deshacen en arena. Conecta cada color de lado a lado.",
    id: "sand",
    icon: Waves,
    status: "Nuevo",
    title: "Sandris",
  },
  {
    accent: "#7c5cff",
    description: "Acomoda piezas, completa líneas y sube de nivel.",
    id: "blocks",
    icon: Grid3X3,
    status: "Jugar ahora",
    title: "Tetris",
  },
  {
    accent: "#14a67a",
    description: "Crece, esquiva tu cola y consigue el récord.",
    id: "snake",
    icon: CircleDot,
    status: "Próximamente",
    title: "Snake",
  },
  {
    accent: "#d97706",
    description: "Combina fichas y alcanza la pieza más alta.",
    id: "merge",
    icon: Sparkles,
    status: "Próximamente",
    title: "2048",
  },
];

function FullscreenGame({ children }) {
  useEffect(() => {
    document.documentElement.classList.add("arcadeGameActive");
    document.body.classList.add("arcadeGameActive");
    return () => {
      document.documentElement.classList.remove("arcadeGameActive");
      document.body.classList.remove("arcadeGameActive");
    };
  }, []);

  return createPortal(
    <div className="arcadeGameScreen">{children}</div>,
    document.body,
  );
}

export default function Arcade() {
  const [activeGame, setActiveGame] = useState(null);

  if (activeGame === "sand") {
    return (
      <FullscreenGame>
        <SandGame onBack={() => setActiveGame(null)} />
      </FullscreenGame>
    );
  }

  if (activeGame === "blocks") {
    return (
      <FullscreenGame>
        <FallingBlocks onBack={() => setActiveGame(null)} />
      </FullscreenGame>
    );
  }

  return (
    <div className="arcadePage">
      <section className="arcadeHero">
        <div className="arcadeHeroContent">
          <span className="arcadeEyebrow">
            <MoonStar aria-hidden="true" size={16} strokeWidth={1.8} />
            Mini arcade
          </span>
          <h2>Un descanso también cuenta.</h2>
          <p>
            Juegos rápidos para desconectarte un rato, superar tus récords y jugar
            desde cualquier lugar.
          </p>
          <div className="arcadeHeroFeatures">
            <span><WifiOff aria-hidden="true" size={15} /> Sin internet</span>
            <span><Trophy aria-hidden="true" size={15} /> Récords locales</span>
            <span><Gamepad2 aria-hidden="true" size={15} /> Celular y PC</span>
          </div>
        </div>
        <div className="arcadeHeroArt" aria-hidden="true">
          <span className="arcadeOrbit arcadeOrbitOne" />
          <span className="arcadeOrbit arcadeOrbitTwo" />
          <span className="arcadeMoon">
            <Gamepad2 size={43} strokeWidth={1.4} />
          </span>
        </div>
      </section>

      <section className="arcadeLibrary" aria-labelledby="arcade-library-title">
        <div className="arcadeLibraryHeading">
          <div>
            <span>Tu colección</span>
            <h2 id="arcade-library-title">Elige un juego</h2>
          </div>
          <small>2 disponibles · más en camino</small>
        </div>

        <div className="arcadeGameGrid">
          {GAMES.map((game) => {
            const Icon = game.icon;
            const available = ["sand", "blocks"].includes(game.id);
            return (
              <button
                type="button"
                key={game.id}
                className={`arcadeGameCard${available ? " arcadeGameCardAvailable" : ""}`}
                onClick={available ? () => setActiveGame(game.id) : undefined}
                disabled={!available}
                style={{ "--game-accent": game.accent }}
              >
                <span className="arcadeGameArtwork">
                  <span className="arcadeGameGlow" />
                  <Icon aria-hidden="true" size={38} strokeWidth={1.45} />
                </span>
                <span className="arcadeGameCopy">
                  <span className="arcadeGameStatus">
                    {!available && <Lock aria-hidden="true" size={12} />}
                    {game.status}
                  </span>
                  <strong>{game.title}</strong>
                  <span>{game.description}</span>
                </span>
                <span className="arcadeGameAction" aria-hidden="true">
                  {available ? <ArrowRight size={18} /> : <Sparkles size={17} />}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
