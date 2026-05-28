// App — root component; wires up browser routing for the whole DeliveryPulse SPA
import { BrowserRouter } from "react-router-dom"; // BrowserRouter syncs URLs with the address bar (HTML5 history API)
import AppRoutes from "./routes/AppRoutes"; // All Route definitions live in AppRoutes.tsx

export default function App() {
  return (
    // BrowserRouter must wrap any component that uses Routes, Link, or Navigate
    <BrowserRouter>
      {/* AppRoutes renders the correct page for the current URL */}
      <AppRoutes />
    </BrowserRouter>
  );
}
