import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  PlusSquare,
  RefreshCw,
  Share2,
  Smartphone,
  WifiOff,
  X,
} from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import useOnlineStatus from "./useOnlineStatus.js";

function isRunningStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export default function PwaStatus() {
  const online = useOnlineStatus();
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [registrationError, setRegistrationError] = useState(false);
  const [standalone, setStandalone] = useState(isRunningStandalone);
  const ios = isIosDevice();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: () => setRegistrationError(true),
  });

  useEffect(() => {
    function captureInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }

    function markInstalled() {
      setStandalone(true);
      setInstallPrompt(null);
      setShowIosGuide(false);
    }

    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", markInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  async function installApp() {
    if (ios) {
      setShowIosGuide(true);
      return;
    }

    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallDismissed(true);
    setInstallPrompt(null);
  }

  const canOfferInstall = !standalone
    && !installDismissed
    && (ios || Boolean(installPrompt));
  const showStatus = !online || needRefresh || offlineReady || canOfferInstall;

  return (
    <>
      {showStatus && (
        <aside className="pwaStatusStack" aria-live="polite">
          {!online && (
            <div className="pwaNotice pwaNoticeOffline" role="status">
              <span className="pwaNoticeIcon">
                <WifiOff aria-hidden="true" size={17} strokeWidth={1.8} />
              </span>
              <span className="pwaNoticeCopy">
                <strong>Estás sin conexión</strong>
                <small>Podrás consultar lo que ya estaba abierto. Los cambios esperan internet.</small>
              </span>
            </div>
          )}

          {needRefresh && (
            <div className="pwaNotice" role="status">
              <span className="pwaNoticeIcon">
                <RefreshCw aria-hidden="true" size={17} strokeWidth={1.8} />
              </span>
              <span className="pwaNoticeCopy">
                <strong>Nueva versión disponible</strong>
                <small>Actualiza para recibir las últimas mejoras.</small>
              </span>
              <span className="pwaNoticeActions">
                <button type="button" onClick={() => void updateServiceWorker(true)}>
                  Actualizar
                </button>
                <button
                  type="button"
                  aria-label="Actualizar después"
                  onClick={() => setNeedRefresh(false)}
                >
                  <X aria-hidden="true" size={15} strokeWidth={1.8} />
                </button>
              </span>
            </div>
          )}

          {offlineReady && online && !needRefresh && (
            <div className="pwaNotice" role="status">
              <span className="pwaNoticeIcon">
                <CheckCircle2 aria-hidden="true" size={17} strokeWidth={1.8} />
              </span>
              <span className="pwaNoticeCopy">
                <strong>Lista para abrirse más rápido</strong>
                <small>La estructura de la aplicación quedó guardada en este dispositivo.</small>
              </span>
              <button
                type="button"
                className="pwaNoticeClose"
                aria-label="Cerrar aviso"
                onClick={() => setOfflineReady(false)}
              >
                <X aria-hidden="true" size={15} strokeWidth={1.8} />
              </button>
            </div>
          )}

          {canOfferInstall && online && !needRefresh && !offlineReady && (
            <div className="pwaNotice" role="status">
              <span className="pwaNoticeIcon">
                <Download aria-hidden="true" size={17} strokeWidth={1.8} />
              </span>
              <span className="pwaNoticeCopy">
                <strong>{ios ? "Todavía está abierta como página web" : "Instala Lili en tu dispositivo"}</strong>
                <small>
                  {ios
                    ? "Si ves la barra del navegador, vuelve a añadirla como app web."
                    : "Ábrela desde tu pantalla de inicio como una aplicación."}
                </small>
              </span>
              <span className="pwaNoticeActions">
                <button type="button" onClick={() => void installApp()}>
                  {ios ? "Ver pasos" : "Instalar"}
                </button>
                <button
                  type="button"
                  aria-label="Cerrar instalación"
                  onClick={() => setInstallDismissed(true)}
                >
                  <X aria-hidden="true" size={15} strokeWidth={1.8} />
                </button>
              </span>
            </div>
          )}
        </aside>
      )}

      {showIosGuide && (
        <div className="pwaInstallOverlay" role="presentation" onMouseDown={() => setShowIosGuide(false)}>
          <section
            className="pwaInstallGuide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <span className="pwaInstallLogo">
                <Smartphone aria-hidden="true" size={22} strokeWidth={1.7} />
              </span>
              <div>
                <small>En iPhone</small>
                <h2 id="pwa-install-title">Añadir Lili como app</h2>
              </div>
              <button
                type="button"
                aria-label="Cerrar instrucciones"
                onClick={() => setShowIosGuide(false)}
              >
                <X aria-hidden="true" size={17} strokeWidth={1.8} />
              </button>
            </header>

            <ol className="pwaInstallSteps">
              <li>
                <span><ExternalLink aria-hidden="true" size={17} strokeWidth={1.8} /></span>
                <div><strong>Abre esta página en Safari</strong><small>La instalación se controla desde el navegador.</small></div>
              </li>
              <li>
                <span><Share2 aria-hidden="true" size={17} strokeWidth={1.8} /></span>
                <div><strong>Toca Compartir</strong><small>Busca el botón cuadrado con una flecha hacia arriba.</small></div>
              </li>
              <li>
                <span><PlusSquare aria-hidden="true" size={17} strokeWidth={1.8} /></span>
                <div><strong>Añadir a pantalla de inicio</strong><small>Activa “Abrir como app web” y después toca Añadir.</small></div>
              </li>
            </ol>

            <p className="pwaInstallWarning">
              Si el icono actual todavía abre una barra con el dominio, elimínalo de la
              pantalla de inicio y créalo nuevamente siguiendo estos pasos.
            </p>

            <button
              type="button"
              className="pwaInstallDone"
              onClick={() => {
                setShowIosGuide(false);
                setInstallDismissed(true);
              }}
            >
              Entendido
            </button>
          </section>
        </div>
      )}

      {registrationError && (
        <span className="srOnly" role="status">
          No se pudo preparar el modo aplicación en este navegador.
        </span>
      )}
    </>
  );
}
