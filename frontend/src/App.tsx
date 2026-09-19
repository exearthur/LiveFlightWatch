import { useState } from "react";
import { Link, Route, Routes } from "react-router-dom";

import {
  Navbar,
  NavBody,
  NavItems,
  NavbarLogo,
  NavbarButton,
  MobileNav,
  MobileNavHeader,
  MobileNavToggle,
  MobileNavMenu,
} from "./components/ui/resizable-navbar";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Flights from "./pages/Flights";
import Home from "./pages/Home";

const navLinks = [
  { name: "Home", link: "/" },
  { name: "About", link: "/about" },
  { name: "Contact", link: "/contact" },
];

function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div>
      <Navbar className="top-0 border-b border-white/10 bg-neutral-950 shadow-md">
        <NavBody className="bg-neutral-950 px-6 py-3">
          <NavbarLogo />
          <NavItems items={navLinks} />
          <Link to="/flights">
            <NavbarButton as="span" variant="gradient" className="cursor-pointer">
              Track a Flight
            </NavbarButton>
          </Link>
        </NavBody>

        <MobileNav className="bg-neutral-950">
          <MobileNavHeader>
            <NavbarLogo />
            <MobileNavToggle
              isOpen={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen((open) => !open)}
            />
          </MobileNavHeader>
          <MobileNavMenu
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
            className="bg-neutral-950"
          >
            {navLinks.map((item) => (
              <Link
                key={item.link}
                to={item.link}
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full py-2 text-neutral-300 hover:text-white"
              >
                {item.name}
              </Link>
            ))}
            <Link
              to="/flights"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-full"
            >
              <NavbarButton as="span" variant="gradient" className="w-full">
                Track a Flight
              </NavbarButton>
            </Link>
          </MobileNavMenu>
        </MobileNav>
      </Navbar>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/flights" element={<Flights />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
      </Routes>
    </div>
  );
}

export default App;
