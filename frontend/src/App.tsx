import { useState } from "react";
import { Star } from "lucide-react";
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
import { ThemeToggle } from "./components/ThemeToggle";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Favorites from "./pages/Favorites";
import Flights from "./pages/Flights";

const navLinks = [
  { name: "Flights", link: "/" },
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
          <div className="relative z-20 flex items-center gap-2">
            <ThemeToggle />
            <Link to="/favorites">
              <NavbarButton
                as="span"
                variant="dark"
                className="inline-flex cursor-pointer items-center gap-1.5"
              >
                <Star className="size-3.5" />
                Favorites
              </NavbarButton>
            </Link>
          </div>
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
            <div className="flex w-full items-center gap-2">
              <Link
                to="/favorites"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex-1"
              >
                <NavbarButton
                  as="span"
                  variant="dark"
                  className="inline-flex w-full items-center justify-center gap-1.5"
                >
                  <Star className="size-3.5" />
                  Favorites
                </NavbarButton>
              </Link>
              <ThemeToggle />
            </div>
          </MobileNavMenu>
        </MobileNav>
      </Navbar>

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
