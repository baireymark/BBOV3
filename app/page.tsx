import Header from "@/components/Header";
import Hero from "@/components/sections/Hero";
import Intro from "@/components/sections/Intro";
import Services from "@/components/sections/Services";
import Approach from "@/components/sections/Approach";
import Company from "@/components/sections/Company";
import { FinalCta, Footer } from "@/components/sections/Contact";

export default function HomePage() {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main">
        <Hero />
        <Intro />
        <Services />
        <Approach />
        <Company />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
