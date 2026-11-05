"use client";
import Link from "next/link";
import BackupPanel from "./backup-panel";
import { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard,
  Trophy,
  Users,
  Building2,
  Flag,
  Megaphone,
  Handshake,
  Star,
  ClipboardList,
  Mail,
  Image as ImageIcon,
  History,
  Settings,
  Search,
  Plus,
  Download,
  RefreshCw,
  ArrowUpRight,
  Menu,
  X,
  Archive,
  RotateCcw,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "./icons";
import EntityEditor, {
  requestApi,
  uploadFile,
  kindLabels,
  type E,
} from "./entity-editor";
import { Avatar, statusName, MatchForm } from "./portal";
import { currentLocale, languageDirection, languageList, translateDom, type Language } from "@/lib/i18n";
const sections: [string, string, typeof LayoutDashboard][] = [
  ["backups", "Zaxira va tiklash", ShieldCheck],
  ["overview", "Umumiy ko‘rinish", LayoutDashboard],
  ["tournament", "Turnirlar", Trophy],
  ["organizer", "Tashkilotchilar", Building2],
  ["athlete", "Sportchilar", Users],
  ["team", "Jamoalar", Flag],
  ["account", "Foydalanuvchilar", ShieldCheck],
  ["registration", "Arizalar", ClipboardList],
  ["match", "O‘yin va natijalar", Flag],
  ["ad", "Reklama kampaniyalari", Megaphone],
  ["sponsor", "Hamkorlar", Handshake],
  ["review", "Sharhlar", Star],
  ["contact", "Murojaatlar", Mail],
  ["message", "Xabarlar", Mail],
  ["media", "Media kutubxonasi", ImageIcon],
  ["audit", "Faoliyat tarixi", History],
  ["settings", "Sayt sozlamalari", Settings],
];
const editable = [
  "tournament",
  "organizer",
  "athlete",
  "team",
  "ad",
  "sponsor",
];
export default function AdminPanel() {
  const [language, setLanguage] = useState<Language>("uz"),
    [languageReady, setLanguageReady] = useState(false),
    [kind, setKind] = useState("overview"),
    [bootstrap, setBootstrap] = useState<E | null>(null),
    [data, setData] = useState<E | null>(null),
    [overview, setOverview] = useState<E | null>(null),
    [page, setPage] = useState(1),
    [q, setQ] = useState(""),
    [archived, setArchived] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [edit, setEdit] = useState<E | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [mobile, setMobile] = useState(false),
    [busy, setBusy] = useState(false),
    [reply, setReply] = useState<E | null>(null),
    [replyText, setReplyText] = useState("");
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [r, b, o] = await Promise.all([
        fetch(
          "/api/admin?kind=" +
            (kind === "backups" ? "overview" : kind) +
            "&page=" +
            page +
            "&q=" +
            encodeURIComponent(q) +
            "&archived=" +
            (archived ? "1" : "0"),
        ),
        fetch("/api/kigo?action=bootstrap"),
        fetch("/api/admin?kind=overview"),
      ]);
      const [a, base, ov] = (await Promise.all([
        r.json(),
        b.json(),
        o.json(),
      ])) as E[];
      if (!r.ok) throw new Error(a.error);
      if (!b.ok) throw new Error(base.error);
      if (!o.ok) throw new Error(ov.error);
      setData(a);
      setBootstrap(base);
      setOverview(ov);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [kind, page, q, archived]);
  useEffect(() => {
    const saved = window.localStorage.getItem("kigo-language") as Language | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore the user's saved locale after hydration to avoid a server/client mismatch.
    if (saved && languageList.some(([code]) => code === saved)) setLanguage(saved);
    setLanguageReady(true);
  }, []);
  useEffect(() => {
    if (!languageReady) return;
    document.documentElement.lang = language;
    document.documentElement.dir = languageDirection(language);
    window.localStorage.setItem("kigo-language", language);
    const root = document.querySelector(".ka-app");
    if (!root) return;
    translateDom(root, language);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "characterData" && record.target.parentNode) translateDom(record.target.parentNode, language);
        for (const node of Array.from(record.addedNodes)) translateDom(node as ParentNode, language);
        if (record.type === "attributes") translateDom(record.target as ParentNode, language);
      }
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "aria-label", "title", "alt"] });
    return () => observer.disconnect();
  }, [language, languageReady]);

  useEffect(() => {
    const timer = setTimeout(() => load(), 200);
    return () => clearTimeout(timer);
  }, [load]);
  // The visible result set changed, so clear selections to prevent acting on hidden rows.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Do not carry selection into a different result set.
    setSelected([]);
  }, [kind, page, q, archived]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  async function act(action: string, p: E = {}, admin = false) {
    setBusy(true);
    setError("");
    try {
      const result = await requestApi(action, p, admin);
      await load(true);
      setNotice("O‘zgarish bazaga saqlandi");
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function archive(id: string, restore = false) {
    if (
      !confirm(
        restore
          ? "Yozuvni tiklaysizmi?"
          : "Yozuvni arxivga o‘tkazasizmi? Uni keyin tiklash mumkin.",
      )
    )
      return;
    await act(restore ? "entity-restore" : "entity-delete", { id });
  }
  const title = sections.find((x) => x[0] === kind)?.[1] || "Admin";
  const counts = Object.fromEntries(
    (overview?.counts || []).map((r: E) => [r.kind, r.n]),
  );
  async function csv() {
    setBusy(true);
    setError("");
    try {
      let items: E[] = [];
      for (let n = 1; n <= (data?.pages || 1); n++) {
        const r = await fetch(
          "/api/admin?kind=" +
            (kind === "backups" ? "overview" : kind) +
            "&page=" +
            n +
            "&q=" +
            encodeURIComponent(q) +
            "&archived=" +
            (archived ? 1 : 0),
        );
        const b = (await r.json()) as E;
        if (!r.ok) throw new Error(b.error);
        items = items.concat(b.items);
      }
      const columns = [
        "id",
        "name",
        "title",
        "email",
        "sport",
        "city",
        "status",
        "role",
        "createdAt",
      ];
      const cell = (v: unknown) => {
        let s = String(v ?? "");
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
        return '"' + s.replaceAll('"', '""') + '"';
      };
      const text =
        "\uFEFF" +
        [
          columns.join(","),
          ...items.map((e) => columns.map((k) => cell(e[k])).join(",")),
        ].join("\r\n");
      const url = URL.createObjectURL(
        new Blob([text], { type: "text/csv;charset=utf-8" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "kigo-" + kind + ".csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ka-app" lang={language} dir={languageDirection(language)}>
      <aside className={"ka-sidebar " + (mobile ? "open" : "")}>
        <Link className="kp-logo" href="/admin">
          <img
            src="/assets/bca122512fa5256bed436ae228fecea1"
            width="30"
            height="31"
            alt=""
          />
          <b>
            KiGo<span className="ka-admin-tag">ADMIN</span>
          </b>
        </Link>
        <div className="ka-workspace">
          <span className="ka-live-dot" />
          Boshqaruv markazi<small>Haqiqiy ma’lumotlar</small>
        </div>
        <nav aria-label="Admin bo‘limlari">
          {sections.map(([key, label, Icon]) => (
            <button
              key={key}
              className={kind === key ? "active" : ""}
              onClick={() => {
                setKind(key);
                setPage(1);
                setQ("");
                setArchived(false);
                setMobile(false);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {counts[key] > 0 && <small>{counts[key]}</small>}
            </button>
          ))}
        </nav>
        <div className="ka-sidebar-bottom">
          <Link href="/" target="_blank" rel="noopener noreferrer">
            Saytni ochish <ArrowUpRight size={16} />
          </Link>
          <Link href="/profil">Shaxsiy kabinet</Link>
        </div>
      </aside>
      {mobile && (
        <button
          className="ka-scrim"
          aria-label="Menyuni yopish"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="ka-main">
        <header className="ka-topbar">
          <div>
            <button
              className="kp-icon-btn ka-menu"
              aria-label="Menyu"
              onClick={() => setMobile(!mobile)}
            >
              <Menu />
            </button>
            <span>Platforma</span>
            <ChevronRight size={14} />
            <strong>{title}</strong>
          </div>
          <div>
            <label className="kp-language-label">
              <select className="kp-language-select" value={language} aria-label="Tilni tanlang" onChange={(event) => setLanguage(event.target.value as Language)}>
                {languageList.map(([code, nativeName]) => <option key={code} value={code}>{nativeName}</option>)}
              </select>
            </label>
            <button
              className="kp-icon-btn"
              aria-label="Yangilash"
              onClick={() => load()}
            >
              <RefreshCw size={18} />
            </button>
            {bootstrap?.user && (
              <span className="kp-person-line">
                <Avatar
                  name={bootstrap.user.name}
                  image={bootstrap.user.image}
                  size={34}
                />
                <strong>{bootstrap.user.name}</strong>
              </span>
            )}
          </div>
        </header>
        <main className="ka-content">
          <div className="ka-page-title">
            <div>
              <span className="kp-eyebrow">KiGo boshqaruvi</span>
              <h1>{title}</h1>
              <p>
                {kind === "overview"
                  ? "Platformadagi haqiqiy faoliyat va boshqaruv."
                  : kind === "ad"
                    ? "Bannerlar, nashr muddatlari, havolalar va haqiqiy ko‘rsatkichlar."
                    : kind === "audit"
                      ? "Kim, qachon va nimani o‘zgartirganini ko‘ring."
                      : "Yaratish, ko‘rish, tahrirlash, arxivlash va tiklash."}
              </p>
            </div>
            {editable.includes(kind) && !archived && (
              <button
                className="kp-btn"
                onClick={() => setEdit({ kind, data: null })}
              >
                <Plus size={18} />
                Yangi {kindLabels[kind]?.toLowerCase()}
              </button>
            )}
            {kind === "match" && !archived && (
              <button
                className="kp-btn"
                onClick={() => setEdit({ kind: "match", data: {} })}
              >
                <Plus size={18} />
                O‘yin qo‘shish
              </button>
            )}
          </div>
          {error && (
            <div className="kp-alert error" role="alert">
              {error}
              <button className="kp-link" onClick={() => load()}>
                Qayta urinish
              </button>
            </div>
          )}
          {kind === "overview" && overview && (
            <>
              <div className="ka-metrics">
                {([
                  ["tournament", "Turnirlar", Trophy],
                  ["account", "Foydalanuvchilar", Users],
                  ["registration", "Arizalar", ClipboardList],
                  ["ad", "Reklamalar", Megaphone],
                ] as [string, string, typeof LayoutDashboard][]).map(([key, label, Icon]) => (
                  <button
                    className="ka-metric"
                    key={key}
                    onClick={() => setKind(key)}
                  >
                    <i>
                      <Icon size={22} />
                    </i>
                    <span>{label}</span>
                    <strong>{counts[key] || 0}</strong>
                    <small>
                      Bazadagi faol yozuvlar <ArrowUpRight size={13} />
                    </small>
                  </button>
                ))}
              </div>
              <div className="kp-grid two ka-section">
                <section className="kp-panel">
                  <div className="kp-section-title">
                    <h2>Reklama natijalari</h2>
                    <button className="kp-link" onClick={() => setKind("ad")}>
                      Boshqarish <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <div className="kp-grid two">
                    <div className="kp-soft-card">
                      <strong>
                        {overview.adStats
                          .filter((s: E) => s.event === "view")
                          .reduce((n: number, s: E) => n + s.n, 0)}
                      </strong>
                      <span>Kunlik noyob ko‘rishlar jami</span>
                    </div>
                    <div className="kp-soft-card">
                      <strong>
                        {overview.adStats
                          .filter((s: E) => s.event === "click")
                          .reduce((n: number, s: E) => n + s.n, 0)}
                      </strong>
                      <span>Kunlik noyob bosishlar jami</span>
                    </div>
                  </div>
                  <p className="kp-muted">
                    Har bir hisob va kampaniya uchun kuniga bir marta
                    hisoblanadi.
                  </p>
                </section>
                <section className="kp-panel">
                  <h2>Xizmatlar holati</h2>
                  <div className="ka-service">
                    <span>Autentifikatsiya · ChatGPT</span>
                    <b className="kp-green">Faol</b>
                  </div>
                  <div className="ka-service">
                    <span>Ma’lumotlar bazasi · MongoDB</span>
                    <b className="kp-green">Faol</b>
                  </div>
                  <div className="ka-service">
                    <span>Fayllar · R2</span>
                    <b className="kp-green">Faol</b>
                  </div>
                  <div className="ka-service">
                    <span>SMS provayderi</span>
                    <b>Ulanmagan</b>
                  </div>
                  <div className="ka-service">
                    <span>Click / Payme</span>
                    <b>Ulanmagan</b>
                  </div>
                  <small>
                    Tashqi to‘lovlar uchun merchant hisob va tasdiqlangan server
                    callback integratsiyasi kerak.
                  </small>
                </section>
              </div>
              <section className="kp-panel ka-section">
                <div className="kp-section-title">
                  <h2>Oxirgi amallar</h2>
                  <button className="kp-link" onClick={() => setKind("audit")}>
                    Barchasi <ArrowUpRight size={15} />
                  </button>
                </div>
                {overview.recent.length ? (
                  overview.recent.slice(0, 8).map((r: E) => (
                    <div className="kp-record-row" key={r.id}>
                      <span className="ka-activity-icon">
                        <History size={17} />
                      </span>
                      <div>
                        <strong>{r.action}</strong>
                        <p>{r.after?.name || r.after?.title || r.entityId}</p>
                      </div>
                      <small>
                        {new Date(r.createdAt).toLocaleString(currentLocale())}
                      </small>
                    </div>
                  ))
                ) : (
                  <p className="ka-empty">
                    Amallar tarixi hali bo‘sh. Birinchi yozuvni yarating.
                  </p>
                )}
              </section>
            </>
          )}
          {kind === "backups" && bootstrap && <BackupPanel user={bootstrap.user}/>}
            {kind === "settings" && bootstrap && (
            <section className="kp-panel">
              <EntityEditor
                key={bootstrap.settings.updatedAt || "settings"}
                kind="settings"
                initial={bootstrap.settings}
                bootstrap={bootstrap}
                onSaved={async () => {
                  await load();
                  setNotice("Sayt sozlamalari yangilandi");
                }}
              />
            </section>
          )}
          {!["overview", "settings", "backups"].includes(kind) && (
            <>
              <div className="ka-toolbar">
                <div className="ka-search">
                  <Search size={18} />
                  <input
                    aria-label="Admin qidiruv"
                    type="search"
                    placeholder="Nom, email yoki ID bo‘yicha qidirish…"
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <button
                  className={
                    "kp-btn secondary small " + (archived ? "selected" : "")
                  }
                  onClick={() => {
                    setArchived(!archived);
                    setPage(1);
                  }}
                >
                  <Archive size={16} />
                  {archived ? "Arxivdagilar" : "Arxiv"}
                </button>
                <button
                  className="kp-btn secondary small"
                  disabled={busy || !data?.items?.length}
                  onClick={csv}
                >
                  <Download size={16} />
                  CSV eksport
                </button>
                {kind === "media" && (
                  <label className="kp-btn small">
                    <Plus size={16} />
                    Rasm yuklash
                    <input
                      hidden
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setBusy(true);
                        try {
                          await uploadFile(f);
                          await load();
                          setNotice("Rasm yuklandi");
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    />
                  </label>
                )}
              </div>
              {selected.length > 0 && (
                <div className="ka-bulk">
                  <strong>{language === "ru" ? `Выбрано: ${selected.length}` : `${selected.length} ta tanlandi`}</strong>
                  <button
                    className="kp-link"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        !confirm(language === "ru"
                          ? `${selected.length} записей ${archived ? "восстановить" : "архивировать"}?`
                          : selected.length + " ta yozuvni " + (archived ? "tiklash" : "arxivlash") + "ni tasdiqlaysizmi?")
                      )
                        return;
                      setBusy(true);
                      try {
                        for (const id of selected)
                          await requestApi(
                            archived ? "entity-restore" : "entity-delete",
                            { id },
                          );
                        setSelected([]);
                        await load(true);
                        setNotice("Tanlangan yozuvlar yangilandi");
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {archived ? "Tiklash" : "Arxivlash"}
                  </button>
                  <button className="kp-link" onClick={() => setSelected([])}>
                    Bekor qilish
                  </button>
                </div>
              )}
              {loading ? (
                <div
                  className="kp-skeleton ka-table-skeleton"
                  role="status"
                  aria-label="Yuklanmoqda"
                />
              ) : kind === "media" ? (
                <div className="kp-grid four ka-media-grid">
                  {data?.items?.map((r: E) => (
                    <article className="kp-panel" key={r.id}>
                      <img src={r.url} alt={r.name} loading="lazy" />
                      <h3>{r.name}</h3>
                      <p>
                        {(r.size / 1024).toFixed(0)} KB · {r.mime}
                      </p>
                      <div className="kp-form-actions">
                        <button
                          className="kp-link"
                          onClick={() =>
                            navigator.clipboard
                              .writeText(r.url)
                              .then(() => setNotice("Rasm havolasi nusxalandi"))
                          }
                        >
                          Havolani nusxalash
                        </button>
                        <button
                          className="kp-link danger"
                          onClick={() => archive(r.id, archived)}
                        >
                          {archived ? "Tiklash" : "Arxivlash"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="kp-panel ka-table-panel">
                  <div className="kp-table-scroll">
                    <table className="kp-table ka-table">
                      <thead>
                        <tr>
                          {!["account", "audit"].includes(kind) && (
                            <th>
                              <input
                                type="checkbox"
                                aria-label="Barchasini tanlash"
                                checked={
                                  !!data?.items?.length &&
                                  selected.length === data.items.length
                                }
                                onChange={(e) =>
                                  setSelected(
                                    e.target.checked
                                      ? data!.items.map((r: E) => r.id)
                                      : [],
                                  )
                                }
                              />
                            </th>
                          )}
                          <th>
                            {kind === "audit" ? "Amal" : "Nomi / ma’lumot"}
                          </th>
                          <th>
                            {kind === "account"
                              ? "Email / rol"
                              : kind === "ad"
                                ? "Ko‘rsatkichlar"
                                : "Tafsilot"}
                          </th>
                          <th>Holat</th>
                          <th>Sana</th>
                          <th>Amallar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data?.items?.map((r: E) => (
                          <tr key={r.id}>
                            {!["account", "audit"].includes(kind) && (
                              <td>
                                <input
                                  type="checkbox"
                                  aria-label={r.name || r.title || r.id}
                                  checked={selected.includes(r.id)}
                                  onChange={(e) =>
                                    setSelected(
                                      e.target.checked
                                        ? [...selected, r.id]
                                        : selected.filter((id) => id !== r.id),
                                    )
                                  }
                                />
                              </td>
                            )}
                            <td>
                              <div className="kp-person-line">
                                {(r.image || r.img) && (
                                  <Avatar
                                    name={r.name || r.title || ""}
                                    image={r.image || r.img}
                                    size={42}
                                  />
                                )}
                                <span>
                                  <strong>
                                    {r.name ||
                                      r.title ||
                                      r.team ||
                                      r.tournamentName ||
                                      (r.home && r.home + " — " + r.away) ||
                                      r.action ||
                                      r.senderName ||
                                      r.id}
                                  </strong>
                                  <small>
                                    {kind === "audit"
                                      ? r.entityId
                                      : kind === "review"
                                        ? r.text?.slice(0, 80)
                                        : kind === "message" ||
                                            kind === "contact"
                                          ? r.text?.slice(0, 100)
                                          : r.sport || r.city || r.slug || ""}
                                  </small>
                                </span>
                              </div>
                            </td>
                            <td>
                              {kind === "account" ? (
                                <>
                                  <span>{r.email}</span>
                                  <small className="ka-cell-small">
                                    {r.role}
                                  </small>
                                </>
                              ) : kind === "ad" ? (
                                <>
                                  <span>
                                    {(() => {
                                      const views = overview?.adStats
                                        .filter((a: E) => a.target === r.id && a.event === "view")
                                        .reduce((n: number, a: E) => n + a.n, 0) || 0;
                                      return language === "ru"
                                        ? `${views} ${views % 10 === 1 && views % 100 !== 11 ? "просмотр" : views % 10 >= 2 && views % 10 <= 4 && (views % 100 < 12 || views % 100 > 14) ? "просмотра" : "просмотров"}`
                                        : `${views} ko‘rish`;
                                    })()}
                                  </span>
                                  <small className="ka-cell-small">
                                    {overview?.adStats
                                      .filter(
                                        (a: E) =>
                                          a.target === r.id &&
                                          a.event === "click",
                                      )
                                      .reduce(
                                        (n: number, a: E) => n + a.n,
                                        0,
                                      ) || 0}{" "}
                                    bosish · {r.slot}
                                  </small>
                                </>
                              ) : kind === "registration" ? (
                                <span>
                                  {r.tournamentName}
                                  <small className="ka-cell-small">
                                    {r.count} ishtirokchi
                                  </small>
                                </span>
                              ) : kind === "review" ? (
                                <span className="kp-rating">
                                  {"★".repeat(r.rating || 0)}
                                </span>
                              ) : kind === "match" ? (
                                <span>
                                  {r.homeScore} : {r.awayScore} · {r.round}
                                </span>
                              ) : (
                                <span>
                                  {r.city ||
                                    r.category ||
                                    r.ownerId?.slice(-8) ||
                                    "—"}
                                </span>
                              )}
                            </td>
                            <td>
                              <span
                                className={
                                  "kp-status " +
                                  (r.status === "active" ||
                                  r.status === "approved" ||
                                  r.status === "confirmed"
                                    ? "green"
                                    : "")
                                }
                              >
                                {archived
                                  ? "Arxivda"
                                  : statusName(
                                      r.status ||
                                        (r.active === false
                                          ? "paused"
                                          : "active"),
                                    )}
                              </span>
                            </td>
                            <td>
                              <small>
                                {new Date(r.createdAt).toLocaleDateString(
                                  currentLocale(),
                                )}
                              </small>
                            </td>
                            <td>
                              <div className="ka-row-actions">
                                {archived ? (
                                  <button
                                    className="kp-link"
                                    onClick={() => archive(r.id, true)}
                                  >
                                    <RotateCcw size={15} />
                                    Tiklash
                                  </button>
                                ) : (
                                  <>
                                    {editable.includes(kind) && (
                                      <button
                                        className="kp-link"
                                        onClick={() =>
                                          setEdit({ kind, data: r })
                                        }
                                      >
                                        Tahrirlash
                                      </button>
                                    )}
                                    {kind === "tournament" && (
                                      <Link
                                        className="kp-link"
                                        href={"/boshqaruv/" + r.slug}
                                      >
                                        Boshqarish
                                      </Link>
                                    )}
                                    {kind === "match" && (
                                      <button
                                        className="kp-link"
                                        onClick={() =>
                                          setEdit({ kind, data: r })
                                        }
                                      >
                                        Hisob
                                      </button>
                                    )}
                                    {kind === "account" && (
                                      <>
                                        <select
                                          aria-label={r.name + " roli"}
                                          value={r.role}
                                          disabled={
                                            r.ownerId === bootstrap?.user?.id ||
                                            (!bootstrap?.user?.isOwner &&
                                              r.role === "admin")
                                          }
                                          onChange={(e) => {
                                            if (
                                              confirm(
                                                "Foydalanuvchi rolini o‘zgartirasizmi?",
                                              )
                                            )
                                              act(
                                                "user-update",
                                                {
                                                  id: r.id,
                                                  role: e.target.value,
                                                },
                                                true,
                                              );
                                          }}
                                        >
                                          {["user", "organizer", "admin"].map(
                                            (x) => (
                                              <option key={x}>{x}</option>
                                            ),
                                          )}
                                        </select>
                                        <button
                                          className="kp-link danger"
                                          disabled={
                                            r.ownerId === bootstrap?.user?.id
                                          }
                                          onClick={() => {
                                            if (
                                              confirm(
                                                "Hisob holatini o‘zgartirasizmi?",
                                              )
                                            )
                                              act(
                                                "user-update",
                                                {
                                                  id: r.id,
                                                  status:
                                                    r.status === "suspended"
                                                      ? "active"
                                                      : "suspended",
                                                },
                                                true,
                                              );
                                          }}
                                        >
                                          {r.status === "suspended"
                                            ? "Faollashtirish"
                                            : "Bloklash"}
                                        </button>
                                      </>
                                    )}
                                    {kind === "review" && (
                                      <>
                                        <button
                                          className="kp-link"
                                          disabled={busy}
                                          onClick={() =>
                                            act(
                                              "moderate",
                                              { id: r.id, status: "approved" },
                                              true,
                                            )
                                          }
                                        >
                                          Tasdiqlash
                                        </button>
                                        <button
                                          className="kp-link danger"
                                          disabled={busy}
                                          onClick={() =>
                                            act(
                                              "moderate",
                                              { id: r.id, status: "rejected" },
                                              true,
                                            )
                                          }
                                        >
                                          Rad etish
                                        </button>
                                      </>
                                    )}
                                    {kind === "registration" &&
                                      ["pending", "awaiting_payment"].includes(
                                        r.status,
                                      ) && (
                                        <>
                                          <button
                                            className="kp-link"
                                            disabled={
                                              busy ||
                                              r.status === "awaiting_payment"
                                            }
                                            onClick={() =>
                                              act("decide-registration", {
                                                id: r.id,
                                                status: "confirmed",
                                              })
                                            }
                                          >
                                            Tasdiqlash
                                          </button>
                                          <button
                                            className="kp-link danger"
                                            disabled={busy}
                                            onClick={() =>
                                              act("decide-registration", {
                                                id: r.id,
                                                status: "rejected",
                                              })
                                            }
                                          >
                                            Rad etish
                                          </button>
                                        </>
                                      )}
                                    {["contact", "message"].includes(kind) && (
                                      <>
                                        <button
                                          className="kp-link"
                                          onClick={() => {
                                            setReply(r);
                                            setReplyText("");
                                          }}
                                        >
                                          Javob
                                        </button>
                                        <select
                                          aria-label="Murojaat holati"
                                          value={r.status || "new"}
                                          onChange={(e) =>
                                            act(
                                              "ticket-status",
                                              {
                                                id: r.id,
                                                status: e.target.value,
                                              },
                                              true,
                                            )
                                          }
                                        >
                                          <option value="new">Yangi</option>
                                          <option value="in_progress">
                                            Ko‘rib chiqilmoqda
                                          </option>
                                          <option value="closed">
                                            Yopilgan
                                          </option>
                                          <option value="replied">
                                            Javob berilgan
                                          </option>
                                        </select>
                                      </>
                                    )}
                                    {!["account", "audit"].includes(kind) && (
                                      <button
                                        className="kp-link danger"
                                        onClick={() => archive(r.id)}
                                      >
                                        Arxivlash
                                      </button>
                                    )}
                                  </>
                                )}
                                <details>
                                  <summary>Tafsilot</summary>
                                  <pre className="ka-json">
                                    {JSON.stringify(r, null, 2)}
                                  </pre>
                                </details>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!data?.items?.length && (
                    <div className="ka-empty">
                      <ClipboardList size={30} />
                      <h3>
                        {q
                          ? "Qidiruv bo‘yicha yozuv topilmadi"
                          : archived
                            ? "Arxiv bo‘sh"
                            : "Hali yozuvlar yo‘q"}
                      </h3>
                      <p>
                        {editable.includes(kind)
                          ? "Yuqoridagi yaratish tugmasi orqali haqiqiy ma’lumot kiriting."
                          : "Yangi faoliyat bo‘lganda yozuvlar shu yerda paydo bo‘ladi."}
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div className="ka-pagination">
                <span>
                  {language === "ru"
                    ? `Всего записей: ${data?.total || 0} · Страница ${page}/${data?.pages || 1}`
                    : <>Jami {data?.total || 0} ta yozuv · {page}/{data?.pages || 1} sahifa</>}
                </span>
                <div>
                  <button
                    className="kp-icon-btn"
                    aria-label="Oldingi sahifa"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    className="kp-icon-btn"
                    aria-label="Keyingi sahifa"
                    disabled={page >= (data?.pages || 1)}
                    onClick={() => setPage(page + 1)}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
        <footer className="ka-footer">
          KiGo admin · Barcha o‘zgarishlar faoliyat tarixiga yoziladi.
        </footer>
      </div>
      {notice && (
        <div className="kp-toast" role="status">
          <Check size={18} />
          {notice}
        </div>
      )}
      {edit && bootstrap && (
        <div className="kp-modal-backdrop">
          <div
            className="kp-modal large"
            role="dialog"
            aria-modal="true"
            aria-label="Yozuv tahrirlash"
          >
            {edit.kind === "match" ? (
              <>
                <label className="kp-form">
                  Turnir
                  <select
                    value={edit.data.slug || ""}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        data: { ...edit.data, slug: e.target.value },
                      })
                    }
                  >
                    <option value="">Turnirni tanlang</option>
                    {[
                      ...bootstrap.tournaments,
                      ...bootstrap.mine.filter(
                        (t: E) =>
                          !bootstrap.tournaments.some((x: E) => x.id === t.id),
                      ),
                    ].map((t: E) => (
                      <option key={t.id} value={t.slug}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                {edit.data.slug ? (
                  <MatchForm
                    key={edit.data.id || edit.data.slug}
                    slug={edit.data.slug}
                    initial={edit.data}
                    bootstrap={bootstrap}
                    close={() => setEdit(null)}
                    onSave={async (p) => {
                      const r = await act("match", p);
                      if (r) setEdit(null);
                    }}
                  />
                ) : (
                  <button
                    className="kp-btn secondary"
                    onClick={() => setEdit(null)}
                  >
                    Yopish
                  </button>
                )}
              </>
            ) : (
              <EntityEditor
                key={edit.data?.id || edit.kind}
                kind={edit.kind}
                initial={edit.data || undefined}
                bootstrap={bootstrap}
                onCancel={() => setEdit(null)}
                onSaved={async () => {
                  setEdit(null);
                  await load(true);
                  setNotice("Yozuv saqlandi");
                }}
              />
            )}
          </div>
        </div>
      )}
      {reply && (
        <div className="kp-modal-backdrop">
          <form
            className="kp-modal kp-form"
            role="dialog"
            aria-modal="true"
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await act("message-reply", {
                id: reply.id,
                text: replyText,
              });
              if (r) setReply(null);
            }}
          >
            <div className="kp-section-title">
              <h2>Murojaatga javob</h2>
              <button
                className="kp-icon-btn"
                type="button"
                aria-label="Yopish"
                onClick={() => setReply(null)}
              >
                <X />
              </button>
            </div>
            <p>{reply.text}</p>
            <label>
              Javob
              <textarea
                required
                minLength={2}
                maxLength={5000}
                rows={5}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
              />
            </label>
            <small>Javob foydalanuvchining KiGo kabinetiga yuboriladi.</small>
            <button disabled={busy} className="kp-btn">
              Yuborish
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
