import Globe from "../Globe";
import SvcLink from "../SvcLink";
import { HERO_STRIP } from "@/lib/content";

export default function Hero() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="aurora" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="wrap hero-grid">
        <div>
          <h1 className="display" id="hero-title">
            <span>Build beyond borders.</span>
            <span>Grow without limits.</span>
          </h1>
          <p className="lede">
            Build a high-performing offshore team in the Philippines that lowers operating costs, strengthens customer
            experience, and gives your business room to scale.
          </p>
          <div className="hero-actions">
            <a className="btn btn-gold" href="#consultation">
              Schedule a consultation
            </a>
            <a className="btn btn-line" href="#services">
              Explore our services
            </a>
          </div>
          <p className="hero-sign">
            <span>Your business.</span>
            <span>Our people.</span>
            <span>One team.</span>
          </p>
        </div>
        <Globe />
      </div>
      <nav className="service-strip" aria-label="Core services">
        <div className="wrap">
          <ul>
            {HERO_STRIP.map((s) => (
              <li key={s.key}>
                <SvcLink svc={s.key}>
                  {s.label}
                  <small>{s.note}</small>
                </SvcLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </section>
  );
}
