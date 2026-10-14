import { FAQS, INDUSTRIES, PROMISES, VALUES } from "@/lib/content";

/** Promise, mission and vision · Values · Industries · About · FAQ */
export default function Company() {
  return (
    <>
      <section className="section on-ink" id="mission" aria-labelledby="promise-title">
        <div className="wrap">
          <h2 className="display" id="promise-title">
            We treat your business like our own.
          </h2>
          <p className="lede" style={{ marginTop: 22 }}>
            When you choose BBO, you trust us with your customers, your reputation, and part of your operation. We take
            that responsibility seriously.
          </p>
          <ul className="promise">
            {PROMISES.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <div className="mv">
            <div>
              <h3>Our mission</h3>
              <p className="main">
                To help businesses grow by connecting them with exceptional Filipino talent and delivering service built
                on trust, accountability, and results.
              </p>
            </div>
            <div>
              <h3>Our vision</h3>
              <p className="main">
                To build a global outsourcing company known for the quality of its people, the strength of its
                partnerships, and the results it delivers.
              </p>
              <p className="sub">We believe geography should never limit great talent or business opportunity.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="values-title">
        <div className="wrap split">
          <h2 className="display" id="values-title">
            What we hold ourselves to.
          </h2>
          <ul className="values">
            {VALUES.map((v) => (
              <li key={v.title}>
                <h3>{v.title}</h3>
                <p>{v.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section mist" aria-labelledby="serve-title">
        <div className="wrap">
          <h2 className="display" id="serve-title">
            BBO supports businesses across:
          </h2>
          <ul className="industries">
            {INDUSTRIES.map((ind, i) => (
              <li key={ind} className={i === 0 ? "lead" : undefined}>
                {ind}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" id="about" aria-labelledby="about-title">
        <div className="wrap split">
          <div className="stack">
            <h2 className="display" id="about-title">
              Beyond borders. Beyond outsourcing.
            </h2>
            <p className="lede">
              Beyond Borders Outsourcing Services Inc. was founded on a simple belief: great businesses deserve access to
              great people, wherever those people live.
            </p>
          </div>
          <div className="stack">
            <p>
              We connect companies with skilled professionals in the Philippines and build dedicated teams around each
              client&apos;s operation.
            </p>
            <p>
              <strong>Our focus is long-term partnership.</strong> We learn where your business is today, where you want
              to take it, and what people and processes will help you get there.
            </p>
            <p className="about-quote">
              We want BBO to become an extension of your company, not another name on your vendor list.
            </p>
          </div>
        </div>
      </section>

      <section className="section mist" id="faq" aria-labelledby="faq-title">
        <div className="wrap split">
          <h2 className="display" id="faq-title">
            Questions businesses ask us.
          </h2>
          <div className="faq">
            {FAQS.map((f, i) => (
              <details key={f.q} open={i === 0}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
