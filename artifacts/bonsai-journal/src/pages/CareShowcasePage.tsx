import { Link } from "wouter";
import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  CloudSnow,
  Leaf,
  SlidersHorizontal,
  Sprout,
} from "lucide-react";
import "./care-showcase.css";

function Mark() {
  return <span className="care-showcase-mark" aria-hidden="true"><Leaf size={18} strokeWidth={1.6} /></span>;
}

const groups = ["Hardy deciduous", "Pines", "Junipers", "Tropical"];

export default function CareShowcasePage() {
  return (
    <main className="care-showcase">
      <header className="cs-nav">
        <Link href="/" className="cs-brand"><Mark /><span>Bonsai Journal</span></Link>
        <nav aria-label="Care showcase navigation">
          <a href="#calendar">The calendar</a>
          <a href="#monthly-guide">Monthly guide</a>
          <Link href="/calendar" className="cs-nav-cta">Open care calendar <ArrowRight size={15} /></Link>
        </nav>
      </header>

      <section className="cs-hero">
        <div className="cs-hero-copy">
          <p className="cs-kicker"><span /> CARE, WITH YOUR TREES IN MIND</p>
          <h1>A little more<br />seasonal <em>clarity.</em></h1>
          <p className="cs-lede">A practical calendar for the trees you grow, alongside a month-by-month guide for cold-winter climates. A place to look things up, then let your own trees have the final word.</p>
          <div className="cs-actions">
            <Link href="/calendar" className="cs-button">Explore the care calendar <ArrowRight size={17} /></Link>
            <a href="#calendar" className="cs-quiet-link">Take a look around <ArrowDown size={15} /></a>
          </div>
          <p className="cs-caveat">Typical timing is a starting point, not a deadline.</p>
        </div>
        <div className="cs-hero-art" aria-label="Illustration of a seasonal care calendar">
          <div className="cs-art-top"><span>YOUR GROWING YEAR</span><span>01 — 12</span></div>
          <div className="cs-calendar-sheet">
            <div className="cs-calendar-title"><div><small>CARE CALENDAR</small><h2>March</h2></div><span className="cs-month-mark">03</span></div>
            <div className="cs-calendar-rule" />
            <p className="cs-sheet-label">A FEW THINGS TO WATCH</p>
            <div className="cs-task"><span className="cs-task-dot" /><div><b>Check for swelling buds</b><small>Let each tree set the pace</small></div><span className="cs-task-tag">OBSERVE</span></div>
            <div className="cs-task"><span className="cs-task-dot is-rust" /><div><b>Plan spring repotting</b><small>Prepare soil and supplies</small></div><span className="cs-task-tag">PLAN</span></div>
            <div className="cs-task"><span className="cs-task-dot" /><div><b>Keep an eye on late cold</b><small>Weather can still turn</small></div><span className="cs-task-tag">NOTICE</span></div>
            <div className="cs-sheet-foot"><span><Leaf size={13} /> Hardy deciduous</span><span>Typical timing</span></div>
          </div>
          <div className="cs-art-note"><span className="cs-note-line" /> Built around your zone<br />and the trees you keep</div>
          <div className="cs-art-stamp">A GUIDE,<br /><i>not a rulebook</i></div>
        </div>
        <span className="cs-side-label">CARE THAT LEAVES ROOM FOR OBSERVATION</span>
      </section>

      <section className="cs-intro-band">
        <p className="cs-index">01 / A USEFUL RHYTHM</p>
        <div><p className="cs-kicker">MADE FOR REAL GROWING</p><h2>Not every tree<br />keeps the <em>same clock.</em></h2></div>
        <p className="cs-band-copy">A calendar can help you remember what to consider. Your climate, species, and the tree in front of you still matter. Bonsai Journal keeps both ideas in view.</p>
      </section>

      <section className="cs-calendar-section" id="calendar">
        <div className="cs-section-heading">
          <div><p className="cs-kicker">02 / YOUR CARE CALENDAR</p><h2>Start with<br /><em>where you grow.</em></h2></div>
          <p>Choose a climate zone and the tree groups in your collection. The calendar brings together typical care timing for those choices.</p>
        </div>
        <div className="cs-customizer">
          <div className="cs-customizer-head"><span className="cs-number">A</span><div><small>SET YOUR CONTEXT</small><h3>A calendar that starts with your collection.</h3></div></div>
          <div className="cs-customizer-body">
            <div className="cs-choice-block">
              <div className="cs-choice-label"><span>01</span><b>Climate zone</b></div>
              <div className="cs-zone-choice"><span className="cs-zone-icon"><SlidersHorizontal size={17} /></span><span><small>SELECTED CLIMATE</small><b>Choose a zone that fits your growing area</b></span><ChevronRight size={16} /></div>
              <p>Zone options help shape typical timing. Local conditions still vary.</p>
            </div>
            <div className="cs-choice-block">
              <div className="cs-choice-label"><span>02</span><b>Tree groups</b></div>
              <div className="cs-groups">{groups.map((group, index) => <span key={group} className={index === 0 ? "selected" : ""}>{index === 0 && <Check size={13} />}{group}</span>)}</div>
              <p>Include the groups you care for, from hardy deciduous trees to tropicals.</p>
            </div>
          </div>
          <div className="cs-customizer-foot"><span><Check size={14} /> Your choices shape the calendar</span><Link href="/calendar">Set up your calendar <ArrowRight size={15} /></Link></div>
        </div>
        <div className="cs-calendar-details">
          <article><span className="cs-detail-icon"><CalendarDays size={18} /></span><div><h3>A year, in useful pieces</h3><p>Move through the months and see tasks grouped by the tree types they apply to.</p></div></article>
          <article><span className="cs-detail-icon"><Sprout size={18} /></span><div><h3>Room for deeper practice</h3><p>Advanced tasks are optional. They include work such as defoliation and bud selection, intended for experienced growers and strong, healthy trees.</p></div></article>
          <article><span className="cs-detail-icon"><Leaf size={18} /></span><div><h3>Tree first, calendar second</h3><p>Timings are approximate. Bud development, weather, and each tree’s condition are better guides than a date alone.</p></div></article>
        </div>
      </section>

      <section className="cs-guide" id="monthly-guide">
        <div className="cs-guide-art">
          <div className="cs-guide-paper">
            <div className="cs-guide-top"><span>MONTHLY GUIDE</span><CloudSnow size={17} /></div>
            <div className="cs-guide-month">01 <span>JANUARY</span></div>
            <h3>A quieter month<br />for bonsai.</h3>
            <p>Protect, monitor and plan.</p>
            <div className="cs-guide-lines"><span /><span /><span /></div>
            <div className="cs-guide-pill">COLD-WINTER CLIMATES</div>
          </div>
          <span className="cs-guide-caption">A month-by-month reference<br />for the quieter season, too.</span>
        </div>
        <div className="cs-guide-copy">
          <p className="cs-kicker">03 / THE MONTHLY GUIDE</p>
          <h2>Winter has<br />its own kind<br />of <em>care.</em></h2>
          <p>The Monthly Guide offers month-by-month guidance written for cold-winter climates. In January, for example, it focuses on winter protection, moisture checks, planning for spring, and observing trees while they rest.</p>
          <p>It is a reference to return to, not a universal schedule. Your region and your trees may be on a different rhythm.</p>
          <Link href="/calendar?tab=guide" className="cs-text-cta">Read the Monthly Guide <ArrowRight size={16} /></Link>
          <div className="cs-guide-note"><span /> Guidance for cold-winter climates</div>
        </div>
      </section>

      <section className="cs-month-strip">
        <div className="cs-month-strip-intro"><p className="cs-kicker">A YEAR OF CHECKING IN</p><h2>Follow the season.<br /><em>Notice what changes.</em></h2></div>
        <div className="cs-months" aria-label="The twelve months of the year">{["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((month, index) => <span key={month} className={index === 0 ? "is-winter" : index === 5 ? "is-summer" : ""}>{month}</span>)}</div>
        <p className="cs-month-note">The guide follows the calendar year; local weather and individual tree response remain part of the picture.</p>
      </section>

      <section className="cs-last-word">
        <div className="cs-orbit" aria-hidden="true"><i /><i /><i /></div>
        <p className="cs-kicker">A QUIET TOOL FOR THE WORK IN PROGRESS</p>
        <h2>Use the guide.<br />Then look at <em>your tree.</em></h2>
        <p>Keep the next season in view, without losing sight of the bonsai right in front of you.</p>
        <div className="cs-last-actions">
          <Link href="/calendar" className="cs-button cs-button-light">Open the Care Calendar <ArrowRight size={16} /></Link>
          <Link href="/calendar?tab=guide" className="cs-last-secondary">Go to the Monthly Guide <ArrowRight size={15} /></Link>
        </div>
      </section>

      <footer className="cs-footer">
        <Link href="/" className="cs-brand"><Mark /><span>Bonsai Journal</span></Link>
        <p>A private journal for the trees you have.</p>
        <div><Link href="/showcase">Journal overview</Link><Link href="/calendar">Care Calendar</Link><Link href="/calendar?tab=guide">Monthly Guide</Link></div>
        <span>© Bonsai Journal</span>
      </footer>
    </main>
  );
}
