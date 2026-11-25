import { Route, Routes } from "react-router-dom";

import { SiteHeader } from "./components/SiteHeader";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Favorites from "./pages/Favorites";
import Flights from "./pages/Flights";

function App() {
  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <Routes>
        <Route path="/" element={<Flights />} />
        <Route path="/flights" element={<Flights />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
      </Routes>
    </div>
  );
}

export default App;
