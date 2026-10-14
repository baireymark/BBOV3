import ClockBoard from "../ClockBoard";
import { COST_LAYERS, PH_SKILLS } from "@/lib/content";

/** Business case · Why the Philippines */
export default function Approach() {
  return (
    <>
      <section className="section on-ink" id="business-case" aria-labelledby="case-title">
        <div className="wrap split">
          <div className="stack">
            <h2 className="display" id="case-title">
              Stop looking only at salary. Look at the total cost of building your team.
            </h2>
            <p className="lede">
              Every employee carries costs beyond base compensation. BBO helps you identify positions and processes where
              offshore staffing creates a stronger financial and operational model.
            </p>
            <p className="objective">
              The objective is simple: spend smarter while maintaining the standards your customers expect.
            </p>
          </div>
          <div>
            <div className="berg">
              <div className="berg-top">
                <b>Salary</b>
                <span>What you see</span>
              </div>
              <div className="waterline" aria-hidden="true" />
              <div className="berg-under">
                <ol>
                  {COST_LAYERS.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ol>
              </div>
            </div>
            <p className="berg-caption">Every line beneath salary is a cost you carry.</p>
          </div>
        </div>
      </section>

      <section className="section" id="philippines" aria-labelledby="ph-title">
        <div className="wrap split">
          <div className="stack">
            <h2 className="display" id="ph-title">
              Global talent for global business.
            </h2>
            <p className="lede">The Philippines has built a deep workforce of professionals experienced in:</p>
            <ul className="chips">
              {PH_SKILLS.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <p>
              <strong>BBO connects this talent directly to your business.</strong> You gain dedicated professionals
              working within your organization without limiting your search for talent to your local market.
            </p>
            <p className="coords">Republic of the Philippines, 12.8797° N, 121.7740° E</p>
          </div>
          <div>
            <h3 style={{ fontSize: "1.25rem", color: "var(--ink)", marginBottom: 16 }}>
              The time right now, from Manila to your market
            </h3>
            <ClockBoard />
            <p className="clock-key">
              <i />9 am to 5 pm local
              <u />
              Inside business hours now
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
