import { PRESSURES, WHY } from "@/lib/content";

/** Before you hire · The BBO difference · Why BBO */
export default function Intro() {
  return (
    <>
      <section className="section" aria-labelledby="hire-title">
        <div className="wrap split">
          <div className="stack">
            <h2 className="display" id="hire-title">
              Before you hire another employee, talk to BBO.
            </h2>
            <p className="lede">
              Growth creates pressure. Adding employees also adds recruiting costs, payroll, benefits, equipment,
              training, management, and overhead.
            </p>
          </div>
          <div>
            <ul className="pressure">
              {PRESSURES.map(([lead, em]) => (
                <li key={em}>
                  {lead}
                  <em>{em}</em>
                </li>
              ))}
            </ul>
            <div className="answer">
              <p className="big">BBO gives you another way to grow.</p>
              <p>
                We build dedicated offshore teams that integrate into your operation and perform the work your business
                needs every day. You keep control of your business. We help you build the team behind it.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section on-ink" id="why-bbo" aria-labelledby="diff-title">
        <div className="wrap">
          <p className="kicker">More than outsourcing. A better way to build your team.</p>
          <h2 className="display statement" id="diff-title">
            BBO does not sell seats.
          </h2>
          <div className="diff-grid">
            <p>
              We build business solutions around people. We start by understanding your operation, your customers, your
              challenges, and your goals.
            </p>
            <p>
              Then we identify the roles, people, processes, and structure needed to support them. Your BBO team works
              within your systems, follows your processes, and represents your brand.
            </p>
            <p className="result">
              The result is a team built around your company instead of forcing your company into an outsourcing
              package.
            </p>
          </div>
          <ul className="why-list">
            {WHY.map((w) => (
              <li key={w.title}>
                <h3>{w.title}</h3>
                <p>{w.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
