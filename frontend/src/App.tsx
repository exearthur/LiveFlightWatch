import {
  Navbar,
  NavBody,
  NavItems,
  NavbarLogo,
  MobileNav,
  MobileNavHeader,
  MobileNavToggle,
  MobileNavMenu,
} from "./components/ui/resizable-navbar";
import { useState } from "react";

function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const navLinks = [
    { name: "Home", link: "/" },
    { name: "Live Flights", link: "/flights" },
    { name: "About", link: "/about" },
    { name: "Contact", link: "/contact" }
  ];

  return(
    <div>
    <Navbar className="bg-black shadow-md">
      <NavBody className="flex items-center justify-between px-4 py-2">
        <NavbarLogo className="text-xl font-bold">Live Flight Watch</NavbarLogo>
        <NavItems items={navLinks} className="hidden md:flex" />
        
      </NavBody>
    </Navbar>
    </div>
  )
}

export default App