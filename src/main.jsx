import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App.jsx";
import AuthGate from "./auth/AuthGate.jsx";
import AuthProvider from "./auth/AuthProvider.jsx";
import "./index.css";
import PwaStatus from "./pwa/PwaStatus.jsx";
import WorkspaceGate from "./workspace/WorkspaceGate.jsx";
import WorkspaceProvider from "./workspace/WorkspaceProvider.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <PwaStatus />
      <AuthGate>
        <WorkspaceProvider>
          <WorkspaceGate>
            <App />
          </WorkspaceGate>
        </WorkspaceProvider>
      </AuthGate>
    </AuthProvider>
  </StrictMode>,
);
