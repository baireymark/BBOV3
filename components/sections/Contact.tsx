import ConsultForm from "../ConsultForm";
import Logo from "../Logo";
import SvcLink from "../SvcLink";
import { CONTACT, FOOTER_COMPANY, SERVICES } from "@/lib/content";

export function FinalCta() {
  return (
    <section className="section contact" id="consultation" aria-labelledby="final-title">
      <div className="aurora" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="wrap split">
        <div>
          <h2 className="display" id="final-title">
            What would your business do with the right team behind it?
          </h2>
          <p className="lede" style={{ marginTop: 22 }}>
            Tell us what you need. We will evaluate your staffing requirements, processes, operating hours, and goals and
            show you where an offshore team makes business sense.
          </p>
          <p className="ladder">
            <span>Start with one position.</span>
            <span>Build an entire team.</span>
            <span>Grow from there.</span>
          </p>
          <p className="reach">
            <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
          </p>
        </div>
        <ConsultForm />
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <Logo sizes="(min-width: 1920px) 396px, (min-width: 1600px) 363px, 330px" />
            <p className="tagline">Your business. Our people. One team.</p>
            <p>
              <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
              <br />
              <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
            </p>
          </div>
          <div>
            <h4>Services</h4>
            <ul>
              {SERVICES.map((s) => (
                <li key={s.key}>
                  <SvcLink svc={s.key}>{s.shortLabel ?? s.label}</SvcLink>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Company</h4>
            <ul>
              {FOOTER_COMPANY.map((l) => (
                <li key={l.href}>
                  <a href={l.href}>{l.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="legal">
          <span>© {new Date().getFullYear()} Beyond Borders Outsourcing Services Inc.</span>
          <span>Innovation without borders.</span>
        </p>
      </div>
    </footer>
  );
}
