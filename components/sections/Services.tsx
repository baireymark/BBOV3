import ServiceTabs from "../ServiceTabs";
import TeamSizer from "../TeamSizer";
import { STEPS } from "@/lib/content";

/** Core services · Team sizer · How it works */
export default function Services() {
  return (
    <>
      <section className="section mist" id="services" aria-labelledby="services-title">
        <div className="wrap">
          <h2 className="display" id="services-title">
            Our core services
          </h2>
          <ServiceTabs />
        </div>
      </section>

      <section className="section" aria-labelledby="built-title">
        <div className="wrap split">
          <div className="stack">
            <h2 className="display" id="built-title">
              One person or an entire department.
            </h2>
            <p className="lede">
              BBO starts with what your business needs today and builds a structure designed to grow with you. Move the
              slider to the team you have in mind.
            </p>
          </div>
          <TeamSizer />
        </div>
      </section>

      <section className="section mist" id="how-it-works" aria-labelledby="how-title">
        <div className="wrap">
          <h2 className="display" id="how-title" style={{ maxWidth: "18ch" }}>
            Six steps from first conversation to a team that grows with you.
          </h2>
          <ol className="steps">
            {STEPS.map((s) => (
              <li key={s.title}>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
