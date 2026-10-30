"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Search,
  Menu,
  X,
  Trophy,
  MapPin,
  CalendarDays,
  Users,
  ChevronRight,
  Plus,
  ShieldCheck,
  Star,
  Bookmark,
  LogOut,
  Settings,
  Image as ImageIcon,
  RefreshCw,
  Mail,
  Check,
  Flag,
  LayoutDashboard,
} from "./icons";
import EntityEditor, { requestApi, ImagePicker, type E } from "./entity-editor";
export const money = (n: number) =>
  n ? new Intl.NumberFormat("uz-UZ").format(n) + " so‘m" : "Bepul";
export const statusName = (s: string) =>
  ({
    draft: "Qoralama",
    ochiq: "Ro‘yxat ochiq",
    jonli: "Jonli",
    tugagan: "Yakunlangan",
    bekor: "Bekor qilingan",
    pending: "Tasdiq kutilmoqda",
    awaiting_payment: "To‘lov kutilmoqda",
    confirmed: "Tasdiqlandi",
    rejected: "Rad etildi",
    cancelled: "Bekor qilindi",
    approved: "Tasdiqlangan",
    active: "Faol",
    paused: "To‘xtatilgan",
    new: "Yangi",
    in_progress: "Ko‘rib chiqilmoqda",
    closed: "Yopilgan",
    replied: "Javob berilgan",
  })[s] || s;
export function Avatar({
  name,
  image,
  size = 48,
}: {
  name: string;
  image?: string;
  size?: number;
}) {
  return image ? (
    <img
      className="kp-avatar"
      src={image}
      width={size}
      height={size}
      alt={name}
      loading="lazy"
    />
  ) : (
    <span
      className="kp-avatar kp-initial"
      style={{ width: size, height: size, fontSize: size / 3 }}
      aria-label={name}
    >
      {(name || "K")
        .split(" ")
        .slice(0, 2)
        .map((s) => s[0])
        .join("")
        .toUpperCase()}
    </span>
  );
}
function SafePhoto({
  src,
  alt,
  className = "",
  priority = false,
}: {
  src?: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [src]);
  return src && !bad ? (
    <img
      className={className}
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setBad(true)}
    />
  ) : (
    <div className={"kp-photo-placeholder " + className}>
      <ImageIcon size={40} />
      <span>Rasm yuklanmagan</span>
    </div>
  );
}
export function Ad({ ad, className = "" }: { ad: E; className?: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (
          entries.some((x) => x.isIntersecting && x.intersectionRatio >= 0.5)
        ) {
          requestApi("track-ad", { id: ad.id, event: "view" }).catch(() => {});
          obs.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ad.id]);
  return (
    <a
      ref={ref}
      className={"kp-ad " + className}
      href={ad.url}
      target={ad.url.startsWith("http") ? "_blank" : undefined}
      rel="noopener noreferrer sponsored"
      onClick={() =>
        requestApi("track-ad", { id: ad.id, event: "click" }).catch(() => {})
      }
    >
      <SafePhoto src={ad.image} alt={ad.title} />
      <div>
        <span className="kp-eyebrow">Reklama</span>
        <h2>{ad.title}</h2>
        <p>{ad.subtitle}</p>
        <span className="kp-btn white">
          {ad.buttonLabel || "Batafsil"} <ArrowRight size={16} />
        </span>
      </div>
    </a>
  );
}
function Empty({
  title,
  text,
  action,
  href,
}: {
  title: string;
  text?: string;
  action?: string;
  href?: string;
}) {
  return (
    <div className="kp-empty">
      <Trophy size={34} />
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action && href && (
        <a className="kp-btn" href={href}>
          {action}
          <ArrowRight size={16} />
        </a>
      )}
    </div>
  );
}
export function TournamentCard({ t }: { t: E }) {
  return (
    <a href={"/turnirlar/" + t.slug} className="kp-tour-card">
      <div className="kp-card-image">
        <SafePhoto src={t.img} alt={t.name} />
        <div className="kp-tags">
          <span>{t.sport}</span>
          <span className={t.price ? "paid" : "free"}>
            {t.price ? "Pullik" : "Bepul"}
          </span>
        </div>
        {t.status === "jonli" && <span className="kp-live">● Jonli</span>}
      </div>
      <div className="kp-card-body">
        <h3>{t.name}</h3>
        <p>
          <MapPin size={15} />
          {t.loc || t.city}
        </p>
        <p>
          <CalendarDays size={15} />
          {t.date || "Sana belgilanmagan"}
        </p>
        <strong className="kp-green">{money(t.price)}</strong>
        <div className="kp-card-bottom">
          <span>
            <Users size={15} />
            {t.cnt}
          </span>
          <i>
            <ChevronRight size={16} />
          </i>
        </div>
      </div>
    </a>
  );
}
const nav = [
  ["/", "Bosh sahifa"],
  ["/turnirlar", "Turnirlar"],
  ["/tashkilotchilar", "Tashkilotchilar"],
  ["/sportchilar", "Sportchilar"],
  ["/biz-haqimizda", "Biz haqimizda"],
];
export default function Portal({
  path = "/",
  initialData,
}: {
  path?: string;
  initialData?: E | null;
}) {
  const [d, setD] = useState<E | null>(initialData || null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(!initialData),
    [menu, setMenu] = useState(false),
    [q, setQ] = useState(""),
    [search, setSearch] = useState(false),
    [editor, setEditor] = useState<E | null>(null),
    [profileTab, setProfileTab] = useState("applications");
  const mounted = useRef(true);
  async function reload() {
    const r = await fetch("/api/kigo?action=bootstrap", { cache: "no-store" });
    const b = (await r.json()) as E;
    if (!r.ok) throw new Error(b.error);
    if (mounted.current) {
      setD(b);
      setError("");
      setLoading(false);
    }
    return b;
  }
  useEffect(() => {
    mounted.current = true;
    if (!initialData)
      reload().catch((e) => {
        setError(e.message);
        setLoading(false);
      });
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") reload().catch(() => {});
    }, 30000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        setSearch(false);
        setEditor(null);
      }
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);
  const notify = (message: string) => setNotice(message);
  const act = async (action: string, b: E = {}) => {
    try {
      const r = await requestApi(action, b);
      await reload();
      notify("Ma’lumot saqlandi");
      return r;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  };
  const settings = d?.settings || {
      name: "KiGo",
      tagline: "Sport turnirlari. Bir platforma. Bitta hamjamiyat.",
    },
    user = d?.user;
  const route = path.split("/").filter(Boolean),
    root = route[0] || "home";
  const header = (
    <header className="kp-header">
      <div className="kp-container kp-header-in">
        <a className="kp-logo" href="/" aria-label="KiGo bosh sahifa">
          <img
            src="/assets/bca122512fa5256bed436ae228fecea1"
            width="32"
            height="34"
            alt=""
          />
          <b>{settings.name}</b>
        </a>
        <nav className="kp-nav" aria-label="Asosiy navigatsiya">
          {nav.map(([href, label]) => (
            <a className={path === href ? "active" : ""} key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
        <div className="kp-header-actions">
          <button
            className="kp-icon-btn"
            aria-label="Qidirish"
            onClick={() => setSearch(true)}
          >
            <Search size={19} />
          </button>
          {user ? (
            <a className="kp-profile-link" href="/profil">
              <Avatar name={user.name} image={user.image} size={36} />
            </a>
          ) : (
            <a className="kp-btn outline small" href="/login">
              Sign in
            </a>
          )}
          <a href="/turnir-yaratish" className="kp-btn small kp-create-link">
            Turnir o‘tkazish
          </a>
          <button
            className="kp-icon-btn kp-burger"
            aria-label="Menyuni ochish"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>
      {menu && (
        <nav className="kp-mobile-nav">
          {nav.map(([href, label]) => (
            <a href={href} key={href}>
              {label}
            </a>
          ))}
          <a href="/turnir-yaratish">Turnir yaratish</a>
          <a href="/profil">Shaxsiy kabinet</a>
          {user?.role === "admin" && <a href="/admin">Admin panel</a>}
        </nav>
      )}
    </header>
  );
  if (loading)
    return (
      <div className="kp-app">
        {header}
        <div className="kp-loading kp-container">
          <div className="kp-skeleton hero" />
          <div className="kp-grid four">
            {[0, 1, 2, 3].map((i) => (
              <div className="kp-skeleton card" key={i} />
            ))}
          </div>
          <span role="status">Sayt ma’lumotlari yuklanmoqda…</span>
        </div>
      </div>
    );
  if (!d)
    return (
      <div className="kp-app">
        {header}
        <main className="kp-container kp-page">
          <div className="kp-alert error" role="alert">
            {error || "Serverga ulanib bo‘lmadi"}
          </div>
          <button
            className="kp-btn"
            onClick={() => {
              setLoading(true);
              reload().catch((e) => {
                setError(e.message);
                setLoading(false);
              });
            }}
          >
            <RefreshCw size={16} />
            Qayta yuklash
          </button>
        </main>
      </div>
    );
  const heading = (title: string, sub?: string) => (
    <div className="kp-page-heading">
      <div>
        <a className="kp-breadcrumb" href="/">
          Bosh sahifa <ChevronRight size={13} />
        </a>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
    </div>
  );
  const cardList = (items: E[]) =>
    items.length ? (
      <div className="kp-grid four">
        {items.map((t) => (
          <TournamentCard key={t.id} t={t} />
        ))}
      </div>
    ) : (
      <Empty
        title="Turnirlar hali yo‘q"
        text="Yangi musobaqa e’lon qilinganda shu yerda ko‘rinadi."
        action="Turnir yaratish"
        href="/turnir-yaratish"
      />
    );
  let content;
  if (root === "home" || root === "landing")
    content = (
      <>
        <section className="kp-home-hero">
          <div className="kp-hero-art">
            <picture>
              {(!settings.heroImage ||
                settings.heroImage === "/media/hero.webp") && (
                <source
                  srcSet="/media/hero-480.webp 480w, /media/hero.webp 1475w"
                  sizes="(max-width:700px) 80vw, 40vw"
                />
              )}
              <img
                src={settings.heroImage || "/media/hero.webp"}
                alt="Sport mashg‘uloti"
                fetchPriority="high"
              />
            </picture>
          </div>
          <div className="kp-container kp-hero-grid">
            <div className="kp-hero-copy">
              <span className="kp-eyebrow">Sport birlashtiradi!</span>
              <h1>{settings.heroTitle}</h1>
              <p>{settings.heroSubtitle}</p>
              <form className="kp-hero-search" action="/turnirlar">
                <Search size={21} />
                <input
                  type="search"
                  name="q"
                  aria-label="Turnir qidirish"
                  placeholder="Turnir, sport turi yoki shahar…"
                />
                <button className="kp-btn">Qidirish</button>
              </form>
              <div className="kp-sports">
                {[
                  ["Futbol", "⚽"],
                  ["Basketbol", "🏀"],
                  ["Tennis", "🎾"],
                  ["Voleybol", "🏐"],
                  ["Padel", "◉"],
                  ["Boshqa", "•••"],
                ].map(([sport, icon]) => (
                  <a
                    href={"/turnirlar?sport=" + encodeURIComponent(sport)}
                    key={sport}
                  >
                    <span>{icon}</span>
                    {sport}
                  </a>
                ))}
              </div>
            </div>
            <div className="kp-hero-aside">
              {d.ads.filter((a: E) => a.slot === "hero").length ? (
                <Ad ad={d.ads.find((a: E) => a.slot === "hero")} />
              ) : (
                <div className="kp-organizer-callout">
                  <span className="kp-mini-icon">
                    <Trophy size={30} />
                  </span>
                  <span className="kp-eyebrow">Tashkilotchilar uchun</span>
                  <h2>Keyingi katta turnir sizniki bo‘lsin.</h2>
                  <p>
                    Ishtirokchilar, arizalar, qur’a va natijalar — barchasi
                    bitta kabinetda.
                  </p>
                  <a href="/turnir-yaratish" className="kp-btn">
                    Turnir yaratish <ArrowRight size={17} />
                  </a>
                </div>
              )}
              <div className="kp-hero-links">
                <a href="/turnirlar">
                  Musobaqa topish <ArrowRight size={17} />
                </a>
                <a href="/tashkilotchilar">
                  Sport hamjamiyati <ArrowRight size={17} />
                </a>
              </div>
            </div>
          </div>
        </section>
        <section className="kp-container kp-section">
          <div className="kp-section-title">
            <div>
              <h2>Yaqin turnirlar</h2>
              <p>Ro‘yxatdan o‘tish ochiq bo‘lgan musobaqalar</p>
            </div>
            <a className="kp-more" href="/turnirlar">
              Barchasini ko‘rish <ArrowRight size={16} />
            </a>
          </div>
          {cardList(
            d.tournaments
              .filter((t: E) => t.status === "ochiq")
              .sort((a: E, b: E) =>
                (a.startDate || "").localeCompare(b.startDate || ""),
              )
              .slice(0, 4),
          )}
        </section>
        {d.ads
          .filter((a: E) => a.slot === "banner")
          .map((a: E) => (
            <section className="kp-container kp-section" key={a.id}>
              <Ad ad={a} className="wide" />
            </section>
          ))}
        <section className="kp-container kp-section kp-grid two">
          <div className="kp-panel">
            <h2>Nega KiGo?</h2>
            <p className="kp-muted">
              Sport musobaqasining barcha bosqichlari bir joyda.
            </p>
            <div className="kp-feature-grid">
              {[
                [
                  Trophy,
                  "Turnir yaratish",
                  "Ma’lumot, vaqt, joy va qoidalarni belgilang.",
                ],
                [
                  Users,
                  "Arizalarni boshqarish",
                  "Jamoalarni qabul qiling va tarkibni tekshiring.",
                ],
                [
                  Flag,
                  "Qur’a va jadval",
                  "Tasdiqlangan ishtirokchilarga juftlik yarating.",
                ],
                [
                  ShieldCheck,
                  "Haqiqiy natijalar",
                  "O‘yin hisoblari asosida reyting yangilanadi.",
                ],
              ].map(([Icon, title, text]: any) => (
                <div key={title}>
                  <i>
                    <Icon size={24} />
                  </i>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="kp-real-stats">
            <div className="kp-section-title">
              <h2>KiGo raqamlarda</h2>
              <span className="kp-data-badge">● Jonli ma’lumot</span>
            </div>
            <div className="kp-stats-grid">
              {[
                ["completedTournaments", "Yakunlangan turnirlar"],
                ["registeredUsers", "Ro‘yxatdan o‘tgan foydalanuvchilar"],
                ["organizers", "Tashkilotchilar"],
                ["sports", "Sport turlari"],
              ].map(([key, label]) => (
                <div key={key}>
                  <strong>
                    {new Intl.NumberFormat("uz-UZ").format(d.stats[key] || 0)}
                  </strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <small>Ko‘rsatkichlar platforma bazasidan hisoblanadi.</small>
          </div>
        </section>
        <section className="kp-container kp-section">
          <div className="kp-section-title">
            <h2>Tashkilotchilar</h2>
            <a href="/tashkilotchilar" className="kp-more">
              Barchasi <ArrowRight size={16} />
            </a>
          </div>
          {d.organizers.length ? (
            <div className="kp-grid four">
              {d.organizers.slice(0, 4).map((o: E) => (
                <OrganizerCard key={o.id} o={o} />
              ))}
            </div>
          ) : (
            <Empty
              title="Sport hamjamiyati shu yerdan boshlanadi"
              text="Tashkilotchi profilingizni yarating va birinchi turniringizni e’lon qiling."
              href="/tashkilotchi-yaratish"
              action="Tashkilotchi bo‘lish"
            />
          )}
        </section>
        <section className="kp-container kp-section">
          <div className="kp-section-title">
            <div>
              <h2>Foydalanuvchilar fikri</h2>
              <p>Namuna sharhlar</p>
            </div>
          </div>
          {d.reviews.length ? (
            <div className="kp-grid three">
              {d.reviews.slice(0, 3).map((review: E) => (
                <article className="kp-panel" key={review.id}>
                  <div className="kp-person-line">
                    <Avatar name={review.who || review.name} />
                    <strong>{review.who || review.name}</strong>
                    <span className="kp-rating">{"★".repeat(review.rating)}</span>
                  </div>
                  <small className="kp-data-badge">Demo</small>
                  <h3>{review.title}</h3>
                  <p>{review.text}</p>
                </article>
              ))}
            </div>
          ) : (
            <Empty title="Hali sharhlar yo‘q" />
          )}
        </section>
        {d.sponsors.length > 0 && (
          <section className="kp-container kp-section">
            <h2>Hamkorlarimiz</h2>
            <div className="kp-sponsors">
              {d.sponsors.map((s: E) => (
                <a
                  href={s.url || undefined}
                  key={s.id}
                  rel="noopener noreferrer"
                  target={s.url ? "_blank" : undefined}
                >
                  <Avatar name={s.name} image={s.image} size={60} />
                  <strong>{s.name}</strong>
                </a>
              ))}
            </div>
          </section>
        )}
        <section className="kp-container kp-section">
          <div className="kp-final-cta">
            <Trophy size={46} />
            <div>
              <h2>Turnir tashkil qilmoqchimisiz?</h2>
              <p>Musobaqangizni yarating va boshqarishni boshlang.</p>
            </div>
            <a className="kp-btn" href="/turnir-yaratish">
              Turnir yaratish <ArrowRight size={17} />
            </a>
          </div>
        </section>
      </>
    );
  else if (root === "turnirlar" && route.length === 1)
    content = (
      <main className="kp-container kp-page">
        {heading(
          "Turnirlar",
          "Sport, shahar va holat bo‘yicha musobaqa toping.",
        )}
        <TournamentCatalog tournaments={d.tournaments} />
      </main>
    );
  else if ((root === "turnirlar" && route[1]) || root === "boshqaruv")
    content = (
      <TournamentDetail
        slug={route[1]}
        manage={root === "boshqaruv"}
        bootstrap={d}
        refresh={reload}
        notify={notify}
      />
    );
  else if (
    ["turnir-yaratish", "tashkilotchi-yaratish", "jamoa-yaratish"].includes(
      root,
    )
  ) {
    const kind =
      root === "turnir-yaratish"
        ? "tournament"
        : root === "jamoa-yaratish"
          ? "team"
          : "organizer";
    content = (
      <main className="kp-container kp-page narrow">
        {heading(
          (
            {
              tournament: "Turnir yaratish",
              team: "Jamoa yaratish",
              organizer: "Tashkilotchi profili",
            } as E
          )[kind],
        )}
        {user ? (
          <EntityEditor
            kind={kind}
            bootstrap={d}
            onSaved={async (e) => {
              await reload();
              location.href =
                kind === "tournament" ? "/boshqaruv/" + e.slug : "/profil";
            }}
          />
        ) : (
          <LoginCard returnTo={path} googleEnabled={d.services.google} />
        )}
      </main>
    );
  } else if (root === "tashkilotchilar" && route.length === 1)
    content = (
      <main className="kp-container kp-page">
        {heading(
          "Tashkilotchilar",
          "Sport klublari va musobaqa tashkilotchilari",
        )}
        <Directory data={d.organizers} kind="organizer" />
        <a className="kp-btn" href="/tashkilotchi-yaratish">
          <Plus size={17} />
          Tashkilotchi profili yaratish
        </a>
      </main>
    );
  else if (root === "tashkilotchilar" && route[1]) {
    const o = d.organizers.find(
      (o: E) => o.slug === route[1] || o.id === route[1],
    );
    content = (
      <main className="kp-container kp-page">
        {o ? (
          <>
            <div className="kp-profile-hero">
              <Avatar name={o.name} image={o.image} size={112} />
              <div>
                <span className="kp-eyebrow">Tashkilotchi</span>
                <h1>
                  {o.name}{" "}
                  {o.verified && <ShieldCheck className="kp-green" size={25} />}
                </h1>
                <p>
                  {o.city} · {o.sport}
                </p>
                {o.rating && (
                  <p className="kp-rating">
                    ★ {o.rating} · {o.reviews.length} sharh
                  </p>
                )}
              </div>
              <button
                className="kp-btn"
                onClick={() =>
                  user
                    ? act("follow", { target: o.id }).catch(() => {})
                    : location.assign("/login")
                }
              >
                {d.follows.some((f: E) => f.target === o.id) ? (
                  <>
                    <Check size={17} />
                    Obunadasiz
                  </>
                ) : (
                  <>
                    <Plus size={17} />
                    Obuna bo‘lish
                  </>
                )}
              </button>
            </div>
            <div className="kp-detail-grid">
              <div>
                <article className="kp-panel">
                  <h2>Klub haqida</h2>
                  <p className="kp-prewrap">
                    {o.description || "Tavsif hali kiritilmagan."}
                  </p>
                </article>
                <section className="kp-section">
                  <h2>Turnirlari</h2>
                  {cardList(
                    d.tournaments.filter((t: E) => t.organizerId === o.id),
                  )}
                </section>
                <Reviews
                  target={o.id}
                  reviews={o.reviews}
                  user={user}
                  notify={notify}
                />
              </div>
              <aside>
                <article className="kp-panel">
                  <h2>Bog‘lanish</h2>
                  {o.phone && (
                    <p>
                      <a href={"tel:" + o.phone}>{o.phone}</a>
                    </p>
                  )}
                  {o.email && (
                    <p>
                      <a href={"mailto:" + o.email}>{o.email}</a>
                    </p>
                  )}
                  {o.website && (
                    <a
                      className="kp-more"
                      target="_blank"
                      rel="noopener noreferrer"
                      href={o.website}
                    >
                      Rasmiy sayt <ArrowRight size={16} />
                    </a>
                  )}
                  <ContactForm
                    target={o.id}
                    user={user}
                    title="Tashkilotchiga xabar"
                    notify={notify}
                  />
                </article>
              </aside>
            </div>
          </>
        ) : (
          <Empty
            title="Tashkilotchi topilmadi"
            href="/tashkilotchilar"
            action="Katalogga qaytish"
          />
        )}
      </main>
    );
  } else if (root === "sportchilar" && route.length === 1)
    content = (
      <main className="kp-container kp-page">
        {heading(
          "Sportchilar va jamoalar",
          "Reyting yakunlangan o‘yinlarning haqiqiy natijalaridan hisoblanadi.",
        )}
        <Athletes data={d} />
      </main>
    );
  else if (
    (root === "sportchilar" && route[1]) ||
    (root === "jamoalar" && route[1])
  ) {
    const team = root === "jamoalar";
    const a = (team ? d.teams : d.athletes).find(
      (a: E) => a.slug === route[1] || a.id === route[1],
    );
    content = (
      <main className="kp-container kp-page">
        {a ? (
          <>
            <div className="kp-profile-hero">
              <Avatar name={a.name} image={a.image} size={112} />
              <div>
                <span className="kp-eyebrow">
                  {team ? "Jamoa" : "Sportchi"}
                </span>
                <h1>{a.name}</h1>
                <p>
                  {a.sport} · {a.city}
                </p>
              </div>
              {!team && (
                <button
                  className="kp-btn"
                  onClick={() =>
                    user
                      ? act("follow", { target: a.id }).catch(() => {})
                      : location.assign("/login")
                  }
                >
                  {d.follows.some((f: E) => f.target === a.id)
                    ? "Kuzatilmoqda"
                    : "Kuzatish"}
                </button>
              )}
            </div>
            <div className="kp-grid four kp-metric-cards">
              {[
                ["matches", "O‘yin"],
                ["wins", "G‘alaba"],
                ["draws", "Durang"],
                ["points", "Ochko"],
              ].map(([k, l]) => (
                <div className="kp-panel" key={k}>
                  <strong>{a[k] || 0}</strong>
                  <span>{l}</span>
                </div>
              ))}
            </div>
            <article className="kp-panel kp-section">
              <h2>{team ? "Jamoa tarkibi" : "Sportchi haqida"}</h2>
              {team ? (
                <div className="kp-grid three">
                  {(a.players || []).map((id: string) => {
                    const p = d.athletes.find((p: E) => p.id === id);
                    return p ? (
                      <a
                        href={"/sportchilar/" + p.slug}
                        className="kp-person-line"
                        key={id}
                      >
                        <Avatar name={p.name} image={p.image} />
                        <strong>{p.name}</strong>
                      </a>
                    ) : null;
                  })}
                </div>
              ) : (
                <p className="kp-prewrap">
                  {a.bio || "Sportchi hali biografiya kiritmagan."}
                </p>
              )}
            </article>
            {!team && (
              <ContactForm
                target={a.id}
                category="invitation"
                user={user}
                title="Taklif yuborish"
                notify={notify}
              />
            )}
          </>
        ) : (
          <Empty
            title="Profil topilmadi"
            action="Sportchilar"
            href="/sportchilar"
          />
        )}
      </main>
    );
  } else if (root === "profil")
    content = (
      <main className="kp-container kp-page">
        {heading("Shaxsiy kabinet")}
        {user ? (
          <>
            <div className="kp-profile-hero">
              <Avatar name={user.name} image={user.image} size={80} />
              <div>
                <h2>{user.name}</h2>
                <p>{user.email}</p>
              </div>
              {user.role === "admin" && (
                <a className="kp-btn" href="/admin">
                  <LayoutDashboard size={17} />
                  Admin panel
                </a>
              )}
            </div>
            <div className="kp-tabs">
              {[
                ["applications", "Arizalarim"],
                ["tournaments", "Turnirlarim"],
                ["organizations", "Tashkilotlarim"],
                ["teams", "Jamoalarim"],
                ["saved", "Saqlanganlar"],
                ["inbox", "Xabarlar"],
                ["reviews", "Sharhlarim"],
                ["settings", "Sozlamalar"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={profileTab === key ? "active" : ""}
                  onClick={() => setProfileTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            {profileTab === "applications" &&
              (d.registrations.length ? (
                <div className="kp-panel">
                  {d.registrations.map((r: E) => (
                    <div key={r.id} className="kp-record-row">
                      <div>
                        <a href={"/turnirlar/" + r.slug}>
                          <strong>{r.tournamentName}</strong>
                        </a>
                        <p>
                          {r.team} · {r.count} ishtirokchi
                        </p>
                      </div>
                      <span className="kp-status">{statusName(r.status)}</span>
                      {!["cancelled", "rejected"].includes(r.status) && (
                        <button
                          className="kp-btn secondary small"
                          onClick={() => {
                            if (confirm("Arizani bekor qilasizmi?"))
                              act("cancel-registration", { id: r.id }).catch(
                                () => {},
                              );
                          }}
                        >
                          Bekor qilish
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  title="Hali ariza yubormagansiz"
                  href="/turnirlar"
                  action="Turnir topish"
                />
              ))}
            {profileTab === "tournaments" && (
              <>
                <div className="kp-section-title">
                  <h2>Turnirlarim</h2>
                  <a className="kp-btn" href="/turnir-yaratish">
                    <Plus size={16} />
                    Yaratish
                  </a>
                </div>
                {d.mine.map((t: E) => (
                  <div className="kp-panel kp-record-row" key={t.id}>
                    <div>
                      <strong>{t.name}</strong>
                      <p>{statusName(t.status)}</p>
                    </div>
                    <a
                      className="kp-btn secondary small"
                      href={"/boshqaruv/" + t.slug}
                    >
                      Boshqarish
                    </a>
                    <button
                      className="kp-btn secondary small"
                      onClick={() => setEditor({ kind: "tournament", data: t })}
                    >
                      Tahrirlash
                    </button>
                    <button
                      className="kp-link danger"
                      onClick={() => {
                        if (confirm("Turnirni arxivga o‘tkazasizmi?"))
                          act("entity-delete", { id: t.id }).catch(() => {});
                      }}
                    >
                      Arxivlash
                    </button>
                  </div>
                ))}
              </>
            )}
            {["organizations", "teams"].includes(profileTab) && (
              <>
                <div className="kp-section-title">
                  <h2>
                    {profileTab === "teams" ? "Jamoalarim" : "Tashkilotlarim"}
                  </h2>
                  <a
                    className="kp-btn"
                    href={
                      profileTab === "teams"
                        ? "/jamoa-yaratish"
                        : "/tashkilotchi-yaratish"
                    }
                  >
                    <Plus size={16} />
                    Yaratish
                  </a>
                </div>
                {(profileTab === "teams" ? d.myTeams : d.myOrganizers).map(
                  (e: E) => (
                    <div className="kp-panel kp-record-row" key={e.id}>
                      <Avatar name={e.name} image={e.image} />
                      <strong>{e.name}</strong>
                      <button
                        className="kp-btn secondary small"
                        onClick={() =>
                          setEditor({
                            kind: profileTab === "teams" ? "team" : "organizer",
                            data: e,
                          })
                        }
                      >
                        Tahrirlash
                      </button>
                      <button
                        className="kp-link danger"
                        onClick={() => {
                          if (confirm("Arxivga o‘tkazasizmi?"))
                            act("entity-delete", { id: e.id }).catch(() => {});
                        }}
                      >
                        Arxivlash
                      </button>
                    </div>
                  ),
                )}
              </>
            )}
            {profileTab === "saved" &&
              cardList(
                d.tournaments.filter((t: E) =>
                  d.bookmarks.some((b: E) => b.target === t.id),
                ),
              )}
            {profileTab === "inbox" && (
              <Inbox messages={d.messages} reload={reload} notify={notify} />
            )}{" "}
            {profileTab === "reviews" && (
              <div className="kp-panel">
                {d.myReviews.length ? (
                  d.myReviews.map((r: E) => (
                    <div className="kp-record-row" key={r.id}>
                      <div>
                        <strong>{r.title}</strong>
                        <p>{r.text}</p>
                      </div>
                      <span className="kp-status">{statusName(r.status)}</span>
                      <button
                        className="kp-link danger"
                        onClick={() => {
                          if (confirm("Sharhni arxivlaysizmi?"))
                            act("entity-delete", { id: r.id }).catch(() => {});
                        }}
                      >
                        Arxivlash
                      </button>
                    </div>
                  ))
                ) : (
                  <Empty title="Sharhlar hali yo‘q" />
                )}
              </div>
            )}
            {profileTab === "settings" && (
              <ProfileForm
                user={user}
                onSaved={async () => {
                  await reload();
                  notify("Profil saqlandi");
                }}
              />
            )}
          </>
        ) : (
          <LoginCard returnTo="/profil" googleEnabled={d.services.google} />
        )}
      </main>
    );
  else if (root === "login" || root === "register")
    content = (
      <main className="kp-container kp-page narrow">
        {user ? (
          <>
            <h1>
              {user.onboarded ? "Profilingiz" : "Ro‘yxatdan o‘tishni yakunlang"}
            </h1>
            <ProfileForm
              user={user}
              onSaved={async () => {
                await reload();
                location.href = "/";
              }}
            />
          </>
        ) : (
          <LoginCard returnTo="/register" googleEnabled={d.services.google} />
        )}
      </main>
    );
  else if (root === "natijalar")
    content = (
      <main className="kp-container kp-page">
        {heading(
          "Turnir natijalari",
          "Yakunlangan musobaqalar va ularning hisoblari",
        )}
        {cardList(d.tournaments.filter((t: E) => t.status === "tugagan"))}
      </main>
    );
  else if (root === "biz-haqimizda")
    content = (
      <main className="kp-container kp-page">
        {heading("Biz haqimizda")}
        <div className="kp-grid two">
          <article className="kp-panel">
            <h2>{settings.name}</h2>
            <p className="kp-prewrap">{settings.about}</p>
            <h3>Qanday ishlaydi?</h3>
            <ol className="kp-steps">
              <li>Hisobingizga kiring va profilingizni to‘ldiring.</li>
              <li>Turnir topib ariza yuboring yoki yangi turnir yarating.</li>
              <li>Tashkilotchi arizalarni tasdiqlaydi va jadval tuzadi.</li>
              <li>Natijalar kiritilganda reyting yangilanadi.</li>
            </ol>
          </article>
          <article className="kp-panel">
            <ContactForm
              user={user}
              title="Biz bilan bog‘lanish"
              notify={notify}
            />
          </article>
        </div>
      </main>
    );
  else if (root === "hamkorlik")
    content = (
      <main className="kp-container kp-page">
        {heading(
          "Reklama va hamkorlik",
          "Sport auditoriyasi bilan bog‘laning.",
        )}
        <div className="kp-grid two">
          <article className="kp-panel">
            <h2>Brendingiz KiGo’da</h2>
            <p>
              Bosh sahifa, keng banner va ichki sahifalarda reklama
              joylashtirish mumkin. Kampaniya muddati, rasmi va havolasi admin
              panelda boshqariladi.
            </p>
            <p>
              Ko‘rishlar va bosishlar haqiqiy tashriflar asosida hisoblanadi.
            </p>
            <div className="kp-grid two">
              <div className="kp-soft-card">
                <strong>{d.stats.registeredUsers}</strong>
                <span>Foydalanuvchi</span>
              </div>
              <div className="kp-soft-card">
                <strong>{d.stats.organizers}</strong>
                <span>Tashkilotchi</span>
              </div>
            </div>
          </article>
          <article className="kp-panel">
            <ContactForm
              category="advertising"
              user={user}
              title="Hamkorlik arizasi"
              notify={notify}
            />
          </article>
        </div>
      </main>
    );
  else if (root === "shartlar")
    content = (
      <main className="kp-container kp-page narrow">
        {heading("Shartlar va maxfiylik")}
        <article className="kp-panel">
          <h2>Foydalanish shartlari</h2>
          <p className="kp-prewrap">
            {settings.terms ||
              "Foydalanish shartlari sayt administratori tomonidan hali kiritilmagan."}
          </p>
          <h2 id="maxfiylik">Maxfiylik siyosati</h2>
          <p className="kp-prewrap">
            {settings.privacy ||
              "Maxfiylik siyosati sayt administratori tomonidan hali kiritilmagan."}
          </p>
        </article>
      </main>
    );
  else
    content = (
      <main className="kp-container kp-page">
        <Empty title="Sahifa topilmadi" href="/" action="Bosh sahifa" />
      </main>
    );
  return (
    <div className="kp-app">
      {header}
      {error && (
        <div className="kp-container">
          <div className="kp-alert error" role="alert">
            {error}
            <button
              className="kp-icon-btn"
              onClick={() => setError("")}
              aria-label="Xatoni yopish"
            >
              <X size={17} />
            </button>
          </div>
        </div>
      )}
      {content}
      <footer className="kp-footer">
        <div className="kp-container kp-footer-grid">
          <div>
            <a className="kp-logo" href="/">
              <b>{settings.name}</b>
            </a>
            <p>{settings.tagline}</p>
          </div>
          <div>
            <h3>Platforma</h3>
            {nav.slice(1).map(([href, label]) => (
              <a href={href} key={href}>
                {label}
              </a>
            ))}
          </div>
          <div>
            <h3>Foydali</h3>
            <a href="/hamkorlik">Reklama va hamkorlik</a>
            <a href="/natijalar">Natijalar</a>
            <a href="/shartlar">Shartlar va maxfiylik</a>
            {user?.role === "admin" && <a href="/admin">Admin panel</a>}
          </div>
          <div>
            <h3>Bog‘lanish</h3>
            {settings.contactEmail && (
              <a href={"mailto:" + settings.contactEmail}>
                {settings.contactEmail}
              </a>
            )}
            {settings.contactPhone && (
              <a href={"tel:" + settings.contactPhone}>
                {settings.contactPhone}
              </a>
            )}
            {settings.telegram && (
              <a
                href={settings.telegram}
                target="_blank"
                rel="noopener noreferrer"
              >
                Telegram
              </a>
            )}
            {settings.instagram && (
              <a
                href={settings.instagram}
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram
              </a>
            )}
            <a href="/biz-haqimizda">Aloqa formasi</a>
          </div>
        </div>
        <div className="kp-container kp-footer-bottom">
          © {new Date().getFullYear()} {settings.name}. Barcha huquqlar
          himoyalangan.<span>O‘zbekcha</span>
        </div>
      </footer>
      <nav className="kp-bottom-nav" aria-label="Telefon navigatsiyasi">{[["/","Bosh sahifa",LayoutDashboard],["/turnirlar","Turnirlar",Trophy],["/sportchilar","Sportchilar",Users],["/profil","Kabinet",ShieldCheck],...(user?.role==="admin"?[["/admin","Admin",Settings]]:[])].map(([href,label,Icon]:any)=><a key={href} href={href} className={path===href?"active":""} aria-current={path===href?"page":undefined}><Icon size={21}/><span>{label}</span></a>)}</nav>
      {notice && (
        <div className="kp-toast" role="status">
          <Check size={18} />
          {notice}
        </div>
      )}
      {search && (
        <div className="kp-modal-backdrop" onClick={() => setSearch(false)}>
          <section
            className="kp-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="search-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kp-section-title">
              <h2 id="search-title">Qidirish</h2>
              <button
                className="kp-icon-btn"
                aria-label="Yopish"
                onClick={() => setSearch(false)}
              >
                <X />
              </button>
            </div>
            <input
              className="kp-search-input"
              autoFocus
              type="search"
              placeholder="Turnir, tashkilotchi, sportchi…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q.trim() ? (
              <div className="kp-search-results">
                {[
                  ...d.tournaments.map((x: E) => ({
                    ...x,
                    url: "/turnirlar/" + x.slug,
                    label: "Turnir",
                  })),
                  ...d.organizers.map((x: E) => ({
                    ...x,
                    url: "/tashkilotchilar/" + x.slug,
                    label: "Tashkilotchi",
                  })),
                  ...d.athletes.map((x: E) => ({
                    ...x,
                    url: "/sportchilar/" + x.slug,
                    label: "Sportchi",
                  })),
                ]
                  .filter((x: E) =>
                    (x.name + " " + x.city + " " + x.sport)
                      .toLowerCase()
                      .includes(q.toLowerCase()),
                  )
                  .map((x: E) => (
                    <a key={x.id} href={x.url}>
                      <strong>{x.name}</strong>
                      <span>
                        {x.label} · {x.city}
                      </span>
                      <ChevronRight size={17} />
                    </a>
                  ))}
                <small>
                  Faqat platformadagi mavjud ma’lumotlar qidiriladi.
                </small>
              </div>
            ) : (
              <p className="kp-muted">Qidirishni boshlang.</p>
            )}
          </section>
        </div>
      )}
      {editor && (
        <div className="kp-modal-backdrop">
          <div
            className="kp-modal large"
            role="dialog"
            aria-modal="true"
            aria-label="Tahrirlash"
          >
            <EntityEditor
              key={editor.data.id}
              kind={editor.kind}
              initial={editor.data}
              bootstrap={d}
              onCancel={() => setEditor(null)}
              onSaved={async () => {
                await reload();
                setEditor(null);
                notify("O‘zgarish saqlandi");
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
function LoginCard({ returnTo,googleEnabled=false }: { returnTo: string;googleEnabled?:boolean }) {
  const [next,setNext]=useState(returnTo),[authError,setAuthError]=useState(""),[mode,setMode]=useState<"signin"|"signup">("signin"),[busy,setBusy]=useState(false);
  useEffect(()=>{const p=new URLSearchParams(location.search),n=p.get("next");if(n&&n.startsWith("/")&&!n.startsWith("//")&&!n.includes("\\"))setNext(n);const e=p.get("auth_error");if(e)setAuthError(e==="google_not_configured"?"Google orqali kirish hali ulanmagan.":"Google bilan kirish yakunlanmadi. Qayta urinib ko‘ring.")},[]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setAuthError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, email: form.get("email"), password: form.get("password"), name: form.get("name") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kirish amalga oshmadi.");
      location.assign(mode === "signup" ? "/register" : next || "/");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Kirish amalga oshmadi. Qayta urinib ko‘ring.");
      setBusy(false);
    }
  }
  return (
    <section className="kp-panel kp-login">
      <span className="kp-login-icon">
        <ShieldCheck size={34} />
      </span>
      <h1>KiGo’ga xush kelibsiz</h1>
      <p>
        Turnirlarga yoziling, jamoangizni boshqaring va sport hamjamiyatiga
        qo‘shiling.
      </p>
      {authError&&<p className="kp-alert error" role="alert">{authError}</p>}
      <form className="kp-auth-form" onSubmit={submit}>
        {mode === "signup" && <label>Ismingiz<input name="name" type="text" autoComplete="name" maxLength={80} /></label>}
        <label>Gmail yoki email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
        <label>KiGo paroli<input name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={8} maxLength={128} /></label>
        <small>Bu KiGo hisobingiz paroli. Google/Gmail parolingizni bu yerga kiritmang.</small>
        <button className="kp-btn" type="submit" disabled={busy}>{busy ? "Kuting…" : mode === "signup" ? "Hisob yaratish" : "Email bilan kirish"}</button>
      </form>
      <button className="kp-auth-toggle" type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setAuthError(""); }}>{mode === "signin" ? "Hisobingiz yo‘qmi? Ro‘yxatdan o‘ting" : "Hisobingiz bormi? Kirish"}</button>
      {googleEnabled?<a target="_top" href={"/auth/google/start?return_to="+encodeURIComponent(next)} className="kp-btn kp-google-button"><GoogleMark/>Google orqali kirish</a>:<><button className="kp-btn kp-google-button" disabled><GoogleMark/>Google orqali kirish</button><small>Google orqali kirish hozircha mavjud emas.</small></>}
      <small>
        Birinchi kirishda KiGo hisobingiz yaratiladi. Keyin profil
        ma’lumotlarini to‘ldirasiz.
      </small>
      <a href="/shartlar" className="kp-muted">
        Shartlar va maxfiylik
      </a>
    </section>
  );
}
function OrganizerCard({ o }: { o: E }) {
  return (
    <a className="kp-panel kp-org-card" href={"/tashkilotchilar/" + o.slug}>
      <Avatar name={o.name} image={o.image} size={64} />
      <h3>
        {o.name} {o.verified && <ShieldCheck size={17} />}
      </h3>
      <p>
        {o.city} · {o.sport}
      </p>
      <span>
        {o.tournaments || 0} turnir{" "}
        {o.rating && (
          <>
            · <b className="kp-rating">★ {o.rating}</b>
          </>
        )}
      </span>
    </a>
  );
}
function Directory({ data, kind }: { data: E[]; kind: string }) {
  const [q, setQ] = useState("");
  const filtered = data.filter((x) =>
    (x.name + " " + x.city + " " + x.sport)
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  return (
    <>
      <div className="kp-filter-bar">
        <Search size={18} />
        <input
          type="search"
          aria-label="Qidirish"
          value={q}
          placeholder="Nomi, sport yoki shahar"
          onChange={(e) => setQ(e.target.value)}
        />
        <span>{filtered.length} ta</span>
      </div>
      {filtered.length ? (
        <div className="kp-grid four">
          {filtered.map((o) => (
            <OrganizerCard key={o.id} o={o} />
          ))}
        </div>
      ) : (
        <Empty
          title={
            q ? "Qidiruv bo‘yicha natija yo‘q" : "Hali tashkilotchilar yo‘q"
          }
        />
      )}
    </>
  );
}
function TournamentCatalog({ tournaments }: { tournaments: E[] }) {
  const [q, setQ] = useState(""),
    [sport, setSport] = useState("Hammasi"),
    [status, setStatus] = useState("ochiq"),
    [city, setCity] = useState("Hammasi"),
    [pay, setPay] = useState("Hammasi"),
    [sort, setSort] = useState("date"),
    [page, setPage] = useState(1);
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    setQ(p.get("q") || "");
    setSport(p.get("sport") || "Hammasi");
  }, []);
  useEffect(() => setPage(1), [q, sport, status, city, pay]);
  let items = tournaments.filter(
    (t) =>
      (!q ||
        (t.name + " " + t.sport + " " + t.city)
          .toLowerCase()
          .includes(q.toLowerCase())) &&
      (sport === "Hammasi" || t.sport === sport) &&
      (status === "all" || t.status === status) &&
      (city === "Hammasi" || t.city === city) &&
      (pay === "Hammasi" || (pay === "free" ? t.price === 0 : t.price > 0)),
  );
  items.sort((a, b) =>
    sort === "date"
      ? (a.startDate || "").localeCompare(b.startDate || "")
      : sort === "popular"
        ? b.registered - a.registered
        : b.price - a.price,
  );
  return (
    <>
      <div className="kp-tabs">
        {[
          ["ochiq", "Ro‘yxat ochiq"],
          ["jonli", "Jonli"],
          ["tugagan", "Yakunlangan"],
          ["all", "Hammasi"],
        ].map(([key, name]) => (
          <button
            key={key}
            className={status === key ? "active" : ""}
            onClick={() => setStatus(key)}
          >
            {name}
            <span>
              {
                tournaments.filter((t) => key === "all" || t.status === key)
                  .length
              }
            </span>
          </button>
        ))}
      </div>
      <div className="kp-filter-bar">
        <Search size={19} />
        <input
          aria-label="Turnir qidirish"
          placeholder="Turnir qidirish…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="Shahar"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        >
          {["Hammasi", ...new Set(tournaments.map((t) => t.city))].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          aria-label="Ishtirok narxi"
          value={pay}
          onChange={(e) => setPay(e.target.value)}
        >
          <option>Hammasi</option>
          <option value="free">Bepul</option>
          <option value="paid">Pullik</option>
        </select>
        <select
          aria-label="Saralash"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="date">Sana bo‘yicha</option>
          <option value="popular">Ommabop</option>
          <option value="price">Narx bo‘yicha</option>
        </select>
      </div>
      <div className="kp-chips">
        {[
          "Hammasi",
          "Futbol",
          "Tennis",
          "Basketbol",
          "Voleybol",
          "Padel",
          "Boks",
          "Boshqa",
        ].map((x) => (
          <button
            key={x}
            className={sport === x ? "active" : ""}
            onClick={() => setSport(x)}
          >
            {x}
          </button>
        ))}
      </div>
      <div className="kp-section-title">
        <p className="kp-muted">{items.length} ta turnir topildi</p>
        <button
          className="kp-link"
          onClick={() => {
            setQ("");
            setSport("Hammasi");
            setCity("Hammasi");
            setPay("Hammasi");
            setStatus("all");
          }}
        >
          Filtrlarni tozalash
        </button>
      </div>
      {items.length ? (
        <div className="kp-grid four">
          {items.slice(0, page * 12).map((t) => (
            <TournamentCard key={t.id} t={t} />
          ))}
        </div>
      ) : (
        <Empty
          title="Turnir topilmadi"
          text="Filtrlarni o‘zgartiring yoki birinchi turniringizni yarating."
          href="/turnir-yaratish"
          action="Turnir yaratish"
        />
      )}
      {items.length > page * 12 && (
        <button className="kp-btn secondary" onClick={() => setPage(page + 1)}>
          Yana ko‘rsatish
        </button>
      )}
    </>
  );
}
function Athletes({ data }: { data: E }) {
  const [kind, setKind] = useState("athletes"),
    [q, setQ] = useState(""),
    [sport, setSport] = useState("Hammasi");
  const items = data[kind].filter(
    (x: E) =>
      (sport === "Hammasi" || x.sport === sport) &&
      (x.name + " " + x.city).toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <div className="kp-tabs">
        {[
          ["athletes", "Sportchilar"],
          ["teams", "Jamoalar"],
        ].map(([k, l]) => (
          <button
            key={k}
            className={kind === k ? "active" : ""}
            onClick={() => setKind(k)}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="kp-filter-bar">
        <Search size={18} />
        <input
          aria-label="Sportchi qidirish"
          placeholder="Ism yoki jamoa nomi"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="Sport turi"
          value={sport}
          onChange={(e) => setSport(e.target.value)}
        >
          {[
            "Hammasi",
            ...new Set<string>(
              data[kind].map((x: E) => x.sport).filter(Boolean),
            ),
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </div>
      {items.length ? (
        <div className="kp-panel kp-table-scroll">
          <table className="kp-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{kind === "teams" ? "Jamoa" : "Sportchi"}</th>
                <th>Sport</th>
                <th>O‘yin</th>
                <th>G‘alaba</th>
                <th>Ochko</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a: E, i: number) => (
                <tr key={a.id}>
                  <td>{i + 1}</td>
                  <td>
                    <a
                      className="kp-person-line"
                      href={
                        "/" +
                        (kind === "teams" ? "jamoalar" : "sportchilar") +
                        "/" +
                        a.slug
                      }
                    >
                      <Avatar name={a.name} image={a.image} size={40} />
                      <span>
                        <strong>{a.name}</strong>
                        <small>{a.city}</small>
                      </span>
                    </a>
                  </td>
                  <td>{a.sport}</td>
                  <td>{a.matches}</td>
                  <td>{a.wins}</td>
                  <td>
                    <b className="kp-green">{a.points}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="Hali profil yoki natijalar yo‘q"
          href="/register"
          action="Profil yaratish"
        />
      )}
      <p className="kp-muted">
        G‘alaba — {data.settings.winPoints} ochko, durang —{" "}
        {data.settings.drawPoints} ochko. Faqat yakunlangan o‘yinlar hisobga
        olinadi.
      </p>
    </>
  );
}
export function ContactForm({
  user,
  title = "Xabar yuborish",
  target = "KiGo",
  category = "support",
  notify,
}: {
  user: E | null;
  title?: string;
  target?: string;
  category?: string;
  notify: (s: string) => void;
}) {
  const [text, setText] = useState(""),
    [phone, setPhone] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="kp-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await requestApi(target === "KiGo" ? "contact" : "message", {
            target,
            text,
            phone,
            category,
          });
          setText("");
          notify(
            "Xabaringiz yuborildi. Javob shaxsiy kabinetingizda ko‘rinadi.",
          );
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>{title}</h3>
      {user ? (
        <>
          <label>
            Aloqa telefoni (ixtiyoriy)
            <input
              type="tel"
              maxLength={30}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label>
            Xabar
            <textarea
              required
              minLength={5}
              maxLength={5000}
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          {error && (
            <p className="kp-alert error" role="alert">
              {error}
            </p>
          )}
          <button className="kp-btn" disabled={busy}>
            {busy ? "Yuborilmoqda…" : "Yuborish"}
            <ArrowRight size={16} />
          </button>
        </>
      ) : (
        <a className="kp-btn secondary" href="/login">
          Xabar yuborish uchun kiring
        </a>
      )}
    </form>
  );
}
function ProfileForm({ user, onSaved }: { user: E; onSaved: () => void }) {
  const [v, setV] = useState({ ...user }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="kp-panel kp-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await requestApi("profile", {
            name: v.name,
            phone: v.phone || "",
            city: v.city || "",
            sport: v.sport || "",
            bio: v.bio || "",
            image: v.image || "",
            notifications: v.notifications || {},
            onboarded: true,
          });
          onSaved();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Profil ma’lumotlari</h2>
      <ImagePicker
        value={v.image || ""}
        onChange={(image) => setV({ ...v, image })}
        label="Profil surati"
      />
      {[
        ["name", "Ism-familiya"],
        ["phone", "Telefon"],
        ["city", "Shahar"],
        ["sport", "Sport turi"],
      ].map(([key, label]) => (
        <label key={key}>
          {label}
          <input
            required={key === "name"}
            minLength={key === "name" ? 2 : undefined}
            maxLength={key === "name" ? 100 : 80}
            type={key === "phone" ? "tel" : "text"}
            value={v[key] || ""}
            onChange={(e) => setV({ ...v, [key]: e.target.value })}
          />
        </label>
      ))}
      <label>
        O‘zingiz haqingizda
        <textarea
          rows={4}
          maxLength={3000}
          value={v.bio || ""}
          onChange={(e) => setV({ ...v, bio: e.target.value })}
        />
      </label>
      <label>
        Email
        <input value={user.email} readOnly />
      </label>
      <small>{user.authProvider === 'password' ? 'KiGo paroli bilan kirilgan.' : `Email ${user.authProvider === 'google' ? 'Google' : 'ChatGPT'} hisobingiz orqali tasdiqlangan.`}</small>
      {error && (
        <p className="kp-alert error" role="alert">
          {error}
        </p>
      )}
      <button className="kp-btn" disabled={busy}>
        {busy ? "Saqlanmoqda…" : "Profilni saqlash"}
      </button>
      <button type="button" className="kp-link" onClick={()=>{const form=document.createElement('form');form.method='POST';form.action='/auth/logout';document.body.appendChild(form);form.submit()}}>Hisobdan chiqish</button>
    </form>
  );
}
export function Inbox({
  messages,
  reload,
  notify,
}: {
  messages: E[];
  reload: () => Promise<any>;
  notify: (s: string) => void;
}) {
  const [reply, setReply] = useState(""),
    [active, setActive] = useState<E | null>(null),
    [error, setError] = useState("");
  return (
    <div className="kp-panel">
      <h2>Xabarlar</h2>
      {messages.length ? (
        messages.map((m) => (
          <article className="kp-message" key={m.id}>
            <div>
              <strong>
                {m.outgoing ? "Yuborilgan xabar" : m.senderName || "KiGo"}
              </strong>
              <small>
                {new Date(m.createdAt).toLocaleString("uz-UZ")} ·{" "}
                {statusName(m.status)}
              </small>
            </div>
            <p>{m.text}</p>
            {!m.outgoing && (
              <button
                className="kp-btn secondary small"
                onClick={() => setActive(m)}
              >
                Javob yozish
              </button>
            )}
          </article>
        ))
      ) : (
        <Empty title="Xabarlar yo‘q" />
      )}
      {active && (
        <form
          className="kp-form"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await requestApi("message-reply", { id: active.id, text: reply });
              setReply("");
              setActive(null);
              await reload();
              notify("Javob yuborildi");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <label>
            Javob
            <textarea
              minLength={2}
              maxLength={5000}
              required
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
          </label>
          <button className="kp-btn">Yuborish</button>
          {error && <p className="kp-alert error">{error}</p>}
        </form>
      )}
    </div>
  );
}
function Reviews({
  target,
  reviews,
  user,
  notify,
}: {
  target: string;
  reviews: E[];
  user: E | null;
  notify: (s: string) => void;
}) {
  const [rating, setRating] = useState(5),
    [title, setTitle] = useState(""),
    [text, setText] = useState(""),
    [error, setError] = useState("");
  return (
    <section className="kp-panel kp-section">
      <h2>Sharhlar ({reviews.length})</h2>
      {reviews.map((r) => (
        <article className="kp-message" key={r.id}>
          <div className="kp-person-line">
            <Avatar name={r.who || r.name} image={r.image} />
            <strong>{r.who || r.name}</strong>
            <span className="kp-rating">{"★".repeat(r.rating)}</span>
          </div>
          <h3>{r.title}</h3>
          <p>{r.text}</p>
        </article>
      ))}
      {!reviews.length && (
        <p className="kp-muted">Hali tasdiqlangan sharhlar yo‘q.</p>
      )}
      {user ? (
        <form
          className="kp-form"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await requestApi("review", { target, rating, title, text });
              setText("");
              setTitle("");
              notify("Sharhingiz moderatsiyaga yuborildi");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <h3>Sharh qoldirish</h3>
          <label>
            Baho
            <select
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} yulduz
                </option>
              ))}
            </select>
          </label>
          <label>
            Sarlavha
            <input
              required
              minLength={2}
              maxLength={150}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Izoh
            <textarea
              required
              minLength={10}
              maxLength={3000}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <button className="kp-btn">Sharh yuborish</button>
          {error && (
            <p className="kp-alert error" role="alert">
              {error}
            </p>
          )}
        </form>
      ) : (
        <a href="/login">Sharh qoldirish uchun kiring</a>
      )}
    </section>
  );
}
function TournamentDetail({
  slug,
  manage,
  bootstrap,
  refresh,
  notify,
}: {
  slug: string;
  manage: boolean;
  bootstrap: E;
  refresh: () => Promise<any>;
  notify: (s: string) => void;
}) {
  const [data, setData] = useState<E | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("about"),
    [edit, setEdit] = useState(false),
    [matchEdit, setMatchEdit] = useState<E | null>(null);
  async function load() {
    const r = await fetch(
      "/api/kigo?action=tournament&slug=" + encodeURIComponent(slug),
      { cache: "no-store" },
    );
    const b = (await r.json()) as E;
    if (!r.ok) throw new Error(b.error);
    setData(b);
  }
  useEffect(() => {
    let active = true;
    load().catch((e) => active && setError(e.message));
    const t = setInterval(() => load().catch(() => {}), 15000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [slug]);
  async function perform(action: string, p: E) {
    setBusy(true);
    setError("");
    try {
      const result = await requestApi(action, p);
      await load();
      await refresh();
      notify(
        action === "draw"
          ? "Qur’a yaratildi" +
              (result.bye
                ? " · " + result.bye + " keyingi bosqichga o‘tdi"
                : "")
          : "Ma’lumot saqlandi",
      );
      return result;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <main className="kp-container kp-page">
        {error ? (
          <Empty title={error} href="/turnirlar" action="Turnirlar" />
        ) : (
          <p role="status">Turnir yuklanmoqda…</p>
        )}
      </main>
    );
  const t = data.tournament,
    user = bootstrap.user,
    org = data.organizer;
  async function calendar() {
    const start = (t.startDate || "").replace(/-/g, ""),
      end = (t.endDate || t.startDate || "").replace(/-/g, "");
    const escape = (s: string) =>
      s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, "\\$&");
    const content = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//KiGo//Turnir//UZ",
      "BEGIN:VEVENT",
      "UID:" + t.id + "@kigo",
      "DTSTAMP:" + new Date().toISOString().replace(/[-:]|\.\d{3}/g, ""),
      "DTSTART;VALUE=DATE:" + start,
      "DTEND;VALUE=DATE:" + end,
      "SUMMARY:" + escape(t.name),
      "LOCATION:" + escape(t.loc),
      "DESCRIPTION:" + escape(t.description),
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    saveBlob(content, "turnir.ics", "text/calendar");
  }
  return (
    <>
      <section className="kp-detail-hero">
        <div className="kp-container">
          <a href="/turnirlar" className="kp-breadcrumb">
            <ArrowLeft size={14} />
            Turnirlar
          </a>
          <div className="kp-chips">
            <span>{t.sport}</span>
            <span>{statusName(t.status)}</span>
          </div>
          <h1>{t.name}</h1>
          <p>{t.description.slice(0, 260)}</p>
          <div className="kp-detail-meta">
            <span>
              <CalendarDays size={18} />
              {t.date}
            </span>
            <span>
              <MapPin size={18} />
              {t.loc}
            </span>
            <span>
              <Users size={18} />
              {t.cnt}
            </span>
          </div>
          {data.isOwner && (
            <div className="kp-form-actions">
              <a className="kp-btn" href={"/boshqaruv/" + slug}>
                Tashkilotchi paneli
              </a>
              <button className="kp-btn outline" onClick={() => setEdit(true)}>
                Tahrirlash
              </button>
            </div>
          )}
        </div>
      </section>
      <main className="kp-container kp-page">
        <div className="kp-detail-grid">
          <section>
            <SafePhoto
              className="kp-detail-cover"
              src={t.img}
              alt={t.name}
              priority
            />
            <div className="kp-tabs">
              {[
                ["about", "Asosiy ma’lumot"],
                ["teams", "Ishtirokchilar"],
                ["schedule", "Jadval va natijalar"],
                ["rules", "Qoidalar"],
                ["reviews", "Sharhlar"],
              ].map(([k, l]) => (
                <button
                  key={k}
                  className={tab === k ? "active" : ""}
                  onClick={() => setTab(k)}
                >
                  {l}
                </button>
              ))}
            </div>
            {tab === "about" && (
              <article className="kp-panel">
                <h2>Turnir haqida</h2>
                <p className="kp-prewrap">
                  {t.description || "Tashkilotchi tavsif kiritmagan."}
                </p>
                <div className="kp-grid two">
                  <div className="kp-soft-card">
                    <small>Jami sovrin</small>
                    <strong>{t.prize || "Ko‘rsatilmagan"}</strong>
                  </div>
                  <div className="kp-soft-card">
                    <small>Ishtirok narxi</small>
                    <strong>{money(t.price)}</strong>
                  </div>
                </div>
                {t.registrationDeadline && (
                  <p>Ro‘yxatdan o‘tish muddati: {t.registrationDeadline}</p>
                )}
              </article>
            )}
            {tab === "teams" && (
              <article className="kp-panel">
                <h2>Ishtirokchilar</h2>
                {data.participants.length ? (
                  data.participants.map((r: E, i: number) => (
                    <div className="kp-record-row" key={r.id || i}>
                      <strong>{r.team}</strong>
                      <span>{r.count} sportchi</span>
                      <span className="kp-status">{statusName(r.status)}</span>
                    </div>
                  ))
                ) : (
                  <p>Hali tasdiqlangan ishtirokchilar yo‘q.</p>
                )}
              </article>
            )}
            {tab === "schedule" && (
              <article className="kp-panel">
                <h2>Jadval va natijalar</h2>
                {data.matches.length ? (
                  data.matches.map((m: E) => <Match key={m.id} m={m} />)
                ) : (
                  <p>O‘yin jadvali hali e’lon qilinmagan.</p>
                )}
                <small>Natijalar har 15 soniyada yangilanadi.</small>
              </article>
            )}
            {tab === "rules" && (
              <article className="kp-panel">
                <h2>Turnir qoidalari</h2>
                <p className="kp-prewrap">
                  {t.rules || "Tashkilotchi nizomni hali kiritmagan."}
                </p>
                {t.rules && (
                  <button
                    className="kp-btn secondary"
                    onClick={() =>
                      saveBlob(
                        t.name + "\n\n" + t.rules,
                        "turnir-nizomi.txt",
                        "text/plain;charset=utf-8",
                      )
                    }
                  >
                    Nizomni yuklash
                  </button>
                )}
              </article>
            )}
            {tab === "reviews" && (
              <Reviews
                target={t.id}
                reviews={data.reviews}
                user={user}
                notify={notify}
              />
            )}
            {manage &&
              (data.isOwner ? (
                <section className="kp-panel kp-section">
                  <div className="kp-section-title">
                    <h2>Tashkilotchi paneli</h2>
                    <button
                      className="kp-btn secondary small"
                      onClick={() => setEdit(true)}
                    >
                      Turnirni tahrirlash
                    </button>
                  </div>
                  <h3>Kelgan arizalar ({data.participants.length})</h3>
                  {data.participants.map((r: E) => (
                    <div className="kp-record-row" key={r.id}>
                      <div>
                        <strong>{r.team}</strong>
                        <p>
                          {r.count} ishtirokchi · {money(r.price)}
                        </p>
                      </div>
                      <span className="kp-status">{statusName(r.status)}</span>
                      {["pending", "awaiting_payment"].includes(r.status) && (
                        <>
                          <button
                            disabled={busy || r.status === "awaiting_payment"}
                            className="kp-btn small"
                            onClick={() =>
                              perform("decide-registration", {
                                id: r.id,
                                status: "confirmed",
                              })
                            }
                          >
                            Tasdiqlash
                          </button>
                          <button
                            disabled={busy}
                            className="kp-btn secondary small"
                            onClick={() =>
                              perform("decide-registration", {
                                id: r.id,
                                status: "rejected",
                              })
                            }
                          >
                            Rad etish
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                  {!data.participants.length && (
                    <p className="kp-muted">Arizalar hali kelmagan.</p>
                  )}
                  <div className="kp-section-title kp-section">
                    <h3>O‘yinlar</h3>
                    <button
                      className="kp-btn secondary small"
                      disabled={busy || data.matches.length > 0}
                      onClick={() => {
                        if (
                          confirm(
                            "Tasdiqlangan ishtirokchilar o‘rtasida qur’a yaratasizmi?",
                          )
                        )
                          perform("draw", { slug });
                      }}
                    >
                      <Flag size={16} />
                      Qur’a yaratish
                    </button>
                    <button
                      className="kp-btn small"
                      onClick={() => setMatchEdit({})}
                    >
                      <Plus size={16} />
                      O‘yin qo‘shish
                    </button>
                  </div>
                  {data.matches.map((m: E) => (
                    <div key={m.id}>
                      <Match m={m} />
                      <button
                        className="kp-link"
                        onClick={() => setMatchEdit(m)}
                      >
                        Hisob va holatni tahrirlash
                      </button>
                    </div>
                  ))}
                </section>
              ) : (
                <div className="kp-alert error">
                  Bu turnirni boshqarish huquqingiz yo‘q.
                </div>
              ))}
          </section>
          <aside>
            <article className="kp-panel kp-registration">
              <h2>Turnirga yozilish</h2>
              <strong className="kp-price">{money(t.price)}</strong>
              <small>
                {t.format === "team" ? "jamoa uchun" : "ishtirokchi uchun"}
              </small>
              {data.myRegistration &&
              !["cancelled", "rejected"].includes(
                data.myRegistration.status,
              ) ? (
                <div className="kp-alert">
                  <Check size={20} />
                  <strong>Arizangiz yuborilgan</strong>
                  <p>{statusName(data.myRegistration.status)}</p>
                  <a href="/profil">Kabinetda ko‘rish</a>
                </div>
              ) : t.status !== "ochiq" ? (
                <p className="kp-alert">Bu turnirga ro‘yxatdan o‘tish yopiq.</p>
              ) : !user ? (
                <a
                  className="kp-btn"
                  target="_top"
                  href={
                    "/login?next=" +
                    encodeURIComponent("/turnirlar/" + slug)
                  }
                >
                  Kirish va ariza yuborish
                </a>
              ) : (
                <form
                  className="kp-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    await perform("register", {
                      slug,
                      team: String(f.get("team")),
                      teamId: String(f.get("teamId") || ""),
                      count: Number(f.get("count")),
                    });
                  }}
                >
                  {t.format === "team" && bootstrap.myTeams.length > 0 && (
                    <label>
                      Jamoa profili (ixtiyoriy)
                      <select name="teamId">
                        <option value="">Jamoani tanlang</option>
                        {bootstrap.myTeams.map((x: E) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    {t.format === "team" ? "Jamoa nomi" : "Ism-familiya"}
                    <input
                      name="team"
                      required
                      minLength={2}
                      maxLength={100}
                      defaultValue={t.format === "solo" ? user.name : ""}
                    />
                  </label>
                  <label>
                    Ishtirokchilar soni
                    <input
                      name="count"
                      type="number"
                      min={1}
                      max={t.format === "solo" ? 1 : 64}
                      defaultValue={t.format === "solo" ? 1 : 10}
                      required
                      readOnly={t.format === "solo"}
                    />
                  </label>
                  <button className="kp-btn" disabled={busy}>
                    {busy ? "Yuborilmoqda…" : "Ariza yuborish"}
                  </button>
                </form>
              )}
              {t.price > 0 && (
                <p className="kp-service-note">
                  To‘lov provayderi hali ulanmagan. Pullik ariza haqiqiy to‘lov
                  tasdiqlanmaguncha kutilmoqda holatida qoladi.
                </p>
              )}
              <button
                className="kp-btn secondary"
                onClick={async () => {
                  try {
                    if (!user) {
                      location.href = "/login";
                      return;
                    }
                    const r = await requestApi("bookmark", { target: t.id });
                    await refresh();
                    notify(
                      r.active ? "Turnir saqlandi" : "Saqlanganlardan olindi",
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <Bookmark size={17} />
                {bootstrap.bookmarks.some((b: E) => b.target === t.id)
                  ? "Saqlangan"
                  : "Saqlash"}
              </button>
            </article>
            {org && (
              <article className="kp-panel">
                <h3>Tashkilotchi</h3>
                <a
                  className="kp-person-line"
                  href={"/tashkilotchilar/" + org.slug}
                >
                  <Avatar name={org.name} image={org.image} />
                  <strong>{org.name}</strong>
                  {org.verified && <ShieldCheck size={20} />}
                </a>
              </article>
            )}
            <article className="kp-panel">
              <h3>Ulashish</h3>
              <img
                className="kp-qr"
                src={"/api/qr?path=" + encodeURIComponent("/turnirlar/" + slug)}
                width={160}
                height={160}
                alt="Turnir QR-kodi"
              />
              <div className="kp-form">
                <button
                  className="kp-btn secondary"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(location.origin + "/turnirlar/" + slug)
                      .then(() => notify("Havola nusxalandi"))
                      .catch(() =>
                        setError("Havolani brauzer manzilidan nusxalang."),
                      )
                  }
                >
                  Havolani nusxalash
                </button>
                <button className="kp-link" onClick={calendar}>
                  <CalendarDays size={16} />
                  Kalendarga qo‘shish
                </button>
                <a
                  className="kp-link"
                  href={
                    "https://t.me/share/url?url=" +
                    encodeURIComponent(
                      typeof location !== "undefined"
                        ? location.origin + "/turnirlar/" + slug
                        : "",
                    )
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Telegramda ulashish
                </a>
              </div>
            </article>
            {bootstrap.ads
              .filter((a: E) => a.slot === "sidebar")
              .map((a: E) => (
                <Ad ad={a} key={a.id} />
              ))}
            {error && (
              <div className="kp-alert error" role="alert">
                {error}
              </div>
            )}
          </aside>
        </div>
      </main>
      {edit && (
        <div className="kp-modal-backdrop">
          <div
            className="kp-modal large"
            role="dialog"
            aria-modal="true"
            aria-label="Turnirni tahrirlash"
          >
            <EntityEditor
              kind="tournament"
              initial={t}
              bootstrap={bootstrap}
              onCancel={() => setEdit(false)}
              onSaved={async () => {
                setEdit(false);
                await load();
                await refresh();
                notify("Turnir yangilandi");
              }}
            />
          </div>
        </div>
      )}
      {matchEdit && (
        <div className="kp-modal-backdrop">
          <div
            className="kp-modal"
            role="dialog"
            aria-modal="true"
            aria-label="O‘yinni tahrirlash"
          >
            <MatchForm
              slug={slug}
              initial={matchEdit}
              bootstrap={bootstrap}
              close={() => setMatchEdit(null)}
              onSave={async (p) => {
                const r = await perform("match", p);
                if (r) setMatchEdit(null);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
function Match({ m }: { m: E }) {
  return (
    <div className="kp-match">
      <div>
        <span>{m.round}</span>
        <span className={m.status === "live" ? "kp-green" : ""}>
          {m.status === "live"
            ? "● Jonli"
            : m.status === "finished"
              ? "Yakunlangan"
              : "Rejada"}
          {m.scheduledAt
            ? " · " + new Date(m.scheduledAt).toLocaleString("uz-UZ")
            : ""}
        </span>
      </div>
      <strong>
        <span>{m.home}</span>
        <b>
          {m.status === "scheduled" ? "—" : m.homeScore + " : " + m.awayScore}
        </b>
        <span>{m.away}</span>
      </strong>
    </div>
  );
}
export function MatchForm({
  slug,
  initial,
  bootstrap,
  close,
  onSave,
}: {
  slug: string;
  initial: E;
  bootstrap: E;
  close: () => void;
  onSave: (p: E) => Promise<void>;
}) {
  const [v, setV] = useState<E>({
      slug,
      home: "",
      away: "",
      homeId: "",
      awayId: "",
      homeScore: 0,
      awayScore: 0,
      round: "1-bosqich",
      status: "scheduled",
      scheduledAt: "",
      ...initial,
    }),
    [busy, setBusy] = useState(false);
  const choices = [...bootstrap.teams, ...bootstrap.athletes];
  return (
    <form
      className="kp-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave(v);
        setBusy(false);
      }}
    >
      <div className="kp-section-title">
        <h2>O‘yin va natija</h2>
        <button
          type="button"
          className="kp-icon-btn"
          aria-label="Yopish"
          onClick={close}
        >
          <X />
        </button>
      </div>
      {["home", "away"].map((side, i) => (
        <div className="kp-form" key={side}>
          <label>
            {i + 1}-raqib profili
            <select
              value={v[side + "Id"]}
              onChange={(e) => {
                const selected = choices.find(
                  (x: E) => x.id === e.target.value,
                );
                setV({
                  ...v,
                  [side + "Id"]: e.target.value,
                  [side]: selected?.name || "",
                });
              }}
            >
              <option value="">Qo‘lda kiritish</option>
              {choices.map((e: E) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {i + 1}-raqib nomi
            <input
              required
              value={v[side]}
              maxLength={100}
              onChange={(e) => setV({ ...v, [side]: e.target.value })}
            />
          </label>
          <label>
            Hisob
            <input
              type="number"
              min={0}
              max={999}
              required
              value={v[side + "Score"]}
              onChange={(e) =>
                setV({ ...v, [side + "Score"]: Number(e.target.value) })
              }
            />
          </label>
        </div>
      ))}
      <label>
        Bosqich
        <input
          required
          value={v.round}
          onChange={(e) => setV({ ...v, round: e.target.value })}
        />
      </label>
      <label>
        Sana va vaqt
        <input
          type="datetime-local"
          value={v.scheduledAt}
          onChange={(e) => setV({ ...v, scheduledAt: e.target.value })}
        />
      </label>
      <label>
        Holat
        <select
          value={v.status}
          onChange={(e) => setV({ ...v, status: e.target.value })}
        >
          <option value="scheduled">Rejada</option>
          <option value="live">Jonli</option>
          <option value="finished">Yakunlangan</option>
        </select>
      </label>
      <small>
        Reyting hisoblanishi uchun raqib profillarini tanlang. Qo‘lda yozilgan
        jamoa nomlari o‘yinda ko‘rinadi.
      </small>
      <button disabled={busy} className="kp-btn">
        {busy ? "Saqlanmoqda…" : "Saqlash"}
      </button>
    </form>
  );
}
function saveBlob(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function GoogleMark(){return <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.41 38.05 46.98 31.91 46.98 24.55Z"/><path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.13.78-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6C30.03 37.65 27.26 38.5 24 38.5c-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>}
