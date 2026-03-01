import { createRoot } from "react-dom/client";

import App from "./App.tsx";
import { isAdminAppHost } from "./lib/runtime";
import "./index.css";

// Set tab title based on app mode (user/admin).
document.title = isAdminAppHost() ? "Readus Admin" : "Readus";

createRoot(document.getElementById("root")!).render(<App />);
