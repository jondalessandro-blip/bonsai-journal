import { Link } from "wouter";
import { ArrowDown, ArrowRight, CalendarDays, Camera, Check, Leaf, LockKeyhole, NotebookPen } from "lucide-react";
import "./showcase.css";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const image = (name: string) => `${basePath}/showcase/${name}`;

const trees = [
  {
    name: "Mugo pine",
    note: "Nursery stock, full of possibility",
    image: "mugo-pine.webp",
    alt: "Young mugo pine growing in a black nursery pot on a wooden table",
    className: "tree-card--pine",
  },
  {
    name: "Alberta spruce",
    note: "A small evergreen, still finding its shape",
    image: "alberta-spruce.webp",
    alt: "Young Alberta spruce in a nursery pot, photographed against pale siding",
    className: "tree-card--spruce",
  },
  {
    name: "Weigela",
    note: "New growth in copper and green",
    image: "weigela.webp",
    alt: "Close view of copper-colored new leaves on a young weigela",
    className: "tree-card--weigela",
  },
  {
    name: "Ficus",
    note: "A developing indoor tree in a training pot",
    image: "ficus.webp",
    alt: "Young ficus with a slender trunk in a dark rectangular training pot",
    className: "tree-card--ficus",
  },
  {
    name: "Pomegranate",
    note: "A young tree, being gently shaped",
    image: "pomegranate.webp",
    alt: "Young pomegranate with wire on its branches, held in a small nursery pot",
    className: "tree-card--pomegranate",
  },
];

function Mark() {
  return (
    <span className="showcase-mark" aria-hidden="true">
      <Leaf size={19} strokeWidth={1.6} />
    </span>
  );
}

export default function ShowcasePage() {
  return (
    <main className="showcase-page">
      <header className="showcase-nav">
        <Link href="/" className="showcase-brand" data-testid="link-showcase-home">
          <Mark />
          <span>Bonsai Journal</span>
        </Link>
        <nav aria-label="Main navigation" className="showcase-nav-links">
          <a href="#trees">The trees</a>
          <a href="#how-it-works">How it works</a>
          <Link href="/sign-up" className="nav-cta" data-testid="link-showcase-signup">Start a journal <ArrowRight size={15} /></Link>
        </nav>
      </header>

      <section className="showcase-hero">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-line" />A private journal for your bonsai</p>
          <h1>Every tree has a <em>next step.</em></h1>
          <p className="hero-intro">
            Log your care, follow your trees in photos, and see what is due this month. Made for growers at every stage, including the nursery pot stage.
          </p>
          <div className="hero-actions">
            <Link href="/sign-up" className="button-primary" data-testid="link-hero-start">Start your private journal <ArrowRight size={17} /></Link>
            <a href="#trees" className="text-link">Meet a few trees <ArrowDown size={15} /></a>
          </div>
          <div className="hero-footnote"><LockKeyhole size={14} /> Your journal is private to you.</div>
        </div>
        <div className="hero-art" aria-label="A young mugo pine, photographed at home">
          <div className="hero-image-wrap">
            <img src={image("mugo-pine.webp")} alt="Young mugo pine in its nursery pot, with fresh needles spreading in every direction" />
          </div>
          <div className="hero-caption"><span className="caption-dot" /> Mugo pine <span className="caption-separator">/</span> still in development</div>
          <div className="hero-index">01 <span>—</span> 05</div>
          <div className="hero-stamp">Small<br />Tree /<br /><i>Big Potential</i></div>
        </div>
        <div className="hero-side-note">NOT JUST THE FINISHED TREE</div>
      </section>

      <section className="manifesto">
        <div className="manifesto-number">01 / WHY A JOURNAL</div>
        <div className="manifesto-content">
          <p className="eyebrow">The honest middle</p>
          <h2>Most of bonsai is the waiting.<br /><em>Keep track of it.</em></h2>
          <p className="manifesto-text">
            Most trees spend far more time growing than posing. The young ones, the awkward ones, the ones you are still figuring out all deserve a record. Bonsai Journal helps you remember what you did, notice what changed, and know what comes next.
          </p>
        </div>
        <div className="manifesto-side">
          <span className="hand-drawn">room to grow</span>
          <div className="manifesto-rule" />
          <p>Small notes add up over the seasons.</p>
        </div>
      </section>

      <section className="trees-section" id="trees">
        <div className="section-heading">
          <div>
            <p className="eyebrow">02 / THE TREES</p>
            <h2>Five beginnings.<br /><em>All worth keeping.</em></h2>
          </div>
          <p className="section-aside">Real trees from a real collection, photographed as they are.</p>
        </div>
        <div className="tree-grid">
          {trees.map((tree, index) => (
            <article className={`tree-card ${tree.className}`} key={tree.name} data-testid={`card-tree-${index + 1}`}>
              <div className="tree-photo">
                <img src={image(tree.image)} alt={tree.alt} loading={index === 0 ? "eager" : "lazy"} />
                <span className="tree-number">0{index + 1}</span>
              </div>
              <div className="tree-meta">
                <div><h3>{tree.name}</h3><p>{tree.note}</p></div>
                <span className="tree-arrow" aria-hidden="true"><ArrowRight size={16} /></span>
              </div>
            </article>
          ))}
        </div>
        <p className="photo-note">The photos here show trees as they are — pots, wire, new growth and all.</p>
      </section>

      <section className="timeline-section" id="how-it-works">
        <div className="timeline-photo">
          <img src={image("ficus.webp")} alt="A young ficus with a slender trunk and open branching in a home setting" loading="lazy" />
          <div className="photo-label">A tree in progress<br /><span>no perfect angle required</span></div>
        </div>
        <div className="timeline-copy">
          <p className="eyebrow">03 / MAKE A RECORD</p>
          <h2>Today’s photo.<br /><em>Next season’s perspective.</em></h2>
          <p>Give each tree its own page. Add photos as it grows, attach a note to any photo, and scroll back through the timeline to see what one snapshot never could.</p>
          <div className="timeline-example">
            <span className="timeline-line" />
            <div className="timeline-entry"><span className="timeline-dot" /><div><small>THEN</small><b>A photo from earlier</b></div></div>
            <div className="timeline-entry"><span className="timeline-dot is-current" /><div><small>NOW</small><b>Another small step</b></div></div>
          </div>
          <div className="feature-tag"><Camera size={15} /> Photo timeline</div>
        </div>
      </section>

      <section className="care-section">
        <div className="care-heading">
          <p className="eyebrow">04 / THE CARE CALENDAR</p>
          <h2>What to do this month,<br /><em>for your zone.</em></h2>
          <p>Choose your hardiness zone and the kinds of trees you grow. Bonsai Journal builds a calendar of typical care for each month, like pruning, repotting, fertilizing, watering and winter prep. A Monthly Guide explains what each month is really about, in plain words.</p>
        </div>
        <div className="care-list">
          <article className="care-sample" data-testid="card-care-calendar-sample">
            <p className="eyebrow care-sample-label">A sample, for hardy deciduous trees</p>
            <div className="care-row" data-testid="row-care-calendar-april">
              <small className="care-sample-month">April</small>
              <div><h3>Repot</h3><p>Repot as buds swell. Trim roots lightly and use a fast draining bonsai mix.</p></div>
            </div>
            <div className="care-row" data-testid="row-care-calendar-may">
              <small className="care-sample-month">May</small>
              <div><h3>Start fertilizing</h3><p>Start feeding once the first leaves have hardened.</p></div>
            </div>
            <div className="care-row" data-testid="row-care-calendar-june">
              <small className="care-sample-month">June</small>
              <div><h3>Clip and grow</h3><p>Let new shoots grow out, then cut back to build fine, twiggy branching.</p></div>
            </div>
            <p className="care-footnote care-sample-caption" data-testid="caption-care-calendar-zone">Timing shifts with your zone.</p>
          </article>
          <p className="care-footnote" data-testid="note-care-calendar-timing">Timing is approximate, so always go by what your tree is actually doing.</p>
        </div>
      </section>

      <section className="care-section">
        <div className="care-heading">
          <p className="eyebrow">05 / CARE, REMEMBERED</p>
          <h2>Stop keeping it all in your head.<br /><em>Spend the time with your trees.</em></h2>
          <p>Write down what you did and what you noticed, so next year you are not guessing.</p>
        </div>
        <div className="care-list">
          <div className="care-row"><span className="care-icon"><NotebookPen size={18} /></span><div><h3>Care logs</h3><p>Record the work and the little details, so you can look back at what worked.</p></div><Check size={17} className="care-check" /></div>
          <div className="care-row"><span className="care-icon"><CalendarDays size={18} /></span><div><h3>Reminders</h3><p>Set a one time reminder or a repeating plan, like every two weeks. Pick months to skip when a task does not apply.</p></div><Check size={17} className="care-check" /></div>
          <div className="care-row"><span className="care-icon"><Check size={18} /></span><div><h3>Done in one tap</h3><p>Tick off several planned tasks across different trees at once.</p></div><Check size={17} className="care-check" /></div>
          <div className="care-row"><span className="care-icon"><Camera size={18} /></span><div><h3>Your collection</h3><p>Search, filter, and select many trees to log or schedule care for all of them together.</p></div><Check size={17} className="care-check" /></div>
          <div className="care-footnote">A journal, not a set of rules. Your trees and your practice are your own.</div>
        </div>
      </section>

      <section className="season-section">
        <div className="season-art">
          <img src={image("weigela.webp")} alt="Copper and green leaves on a young weigela, showing the detail of its new growth" loading="lazy" />
          <span className="season-sticker">notice<br />the small<br /><i>changes</i></span>
        </div>
        <div className="season-copy">
          <p className="eyebrow">06 / OVER TIME</p>
          <h2>One season<br />is only <em>one page.</em></h2>
          <p>A new leaf. A pruning note. A stretch of quiet growth. Keep those small moments somewhere you can come back to. You do not need the whole plan before you begin.</p>
          <span className="season-signoff">Start where your tree is.</span>
        </div>
      </section>

      <section className="closing-section">
        <div className="closing-orbit" aria-hidden="true"><span /><span /><span /></div>
        <p className="eyebrow">07 / YOUR TURN</p>
        <h2>Make a little room<br />for <em>what’s growing.</em></h2>
        <p>Start with one tree, one photo, or one note from today.</p>
        <Link href="/sign-up" className="button-primary button-light" data-testid="link-bottom-start">Start your private journal <ArrowRight size={17} /></Link>
        <div className="closing-quiet"><LockKeyhole size={14} /> Your trees. Your notes. Just for you.</div>
      </section>

      <footer className="showcase-footer">
        <Link href="/" className="showcase-brand" data-testid="link-footer-home"><Mark /><span>Bonsai Journal</span></Link>
        <p>A quiet record of every tree.</p>
        <div className="footer-links"><Link href="/sign-in">Sign in</Link><Link href="/sign-up">Get started</Link></div>
        <span className="footer-copy">© Bonsai Journal</span>
      </footer>
    </main>
  );
}
