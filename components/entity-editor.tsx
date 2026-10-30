"use client";
import { useState } from "react";
export type E = Record<string, any>;
export async function requestApi(action: string, data: E = {}, admin = false) {
  const response = await fetch(admin ? "/api/admin" : "/api/kigo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...data }),
  });
  const body = (await response.json()) as E;
  if (!response.ok) throw new Error(body.error || "So‘rov bajarilmadi");
  return body;
}
export async function uploadFile(file: File) {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Rasm 10 MB dan kichik bo‘lsin");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("JPG, PNG yoki WebP tanlang");
  const form = new FormData();
  form.append("file", file);
  const r = await fetch("/api/upload", { method: "POST", body: form });
  const b = (await r.json()) as E;
  if (!r.ok) throw new Error(b.error);
  return b.url as string;
}
export const kindLabels: E = {
  tournament: "Turnir",
  organizer: "Tashkilotchi",
  athlete: "Sportchi",
  team: "Jamoa",
  ad: "Reklama",
  sponsor: "Hamkor",
  settings: "Sayt sozlamalari",
};
export const blanks: E = {
  tournament: {
    name: "",
    sport: "Futbol",
    description: "",
    city: "",
    address: "",
    startDate: "",
    endDate: "",
    registrationDeadline: "",
    capacity: 16,
    format: "team",
    price: 0,
    prize: "",
    img: "",
    organizerId: "",
    rules: "",
    status: "draft",
  },
  organizer: {
    name: "",
    city: "",
    sport: "Futbol",
    description: "",
    image: "",
    phone: "",
    email: "",
    website: "",
    verified: false,
  },
  athlete: {
    name: "",
    city: "",
    sport: "Futbol",
    bio: "",
    image: "",
    userId: "",
  },
  team: { name: "", city: "", sport: "Futbol", image: "", players: [] },
  ad: {
    name: "",
    title: "",
    subtitle: "",
    image: "",
    url: "",
    buttonLabel: "Batafsil",
    slot: "hero",
    status: "draft",
    startDate: "",
    endDate: "",
    priority: 0,
  },
  sponsor: { name: "", image: "", url: "", active: true },
};
const fieldDefs: E = {
  tournament: [
    ["name", "Turnir nomi"],
    ["sport", "Sport turi", "sport"],
    ["description", "Tavsif", "textarea"],
    ["organizerId", "Tashkilotchi", "organizer"],
    ["city", "Shahar"],
    ["address", "Manzil"],
    ["startDate", "Boshlanish", "date"],
    ["endDate", "Tugash", "date"],
    ["registrationDeadline", "Ro‘yxat muddati", "date"],
    ["capacity", "Jamoa / ishtirokchi limiti", "number"],
    ["format", "Format", "select", "team:Jamoaviy,solo:Yakka"],
    ["price", "Ishtirok narxi (UZS)", "number"],
    ["prize", "Sovrin"],
    ["rules", "Nizom va qoidalar", "textarea"],
    ["img", "Turnir muqovasi", "image"],
    [
      "status",
      "Holat",
      "select",
      "draft:Qoralama,ochiq:Ro‘yxat ochiq,jonli:Jonli,tugagan:Yakunlangan,bekor:Bekor qilingan",
    ],
  ],
  organizer: [
    ["name", "Tashkilot nomi"],
    ["city", "Shahar"],
    ["sport", "Sport turi", "sport"],
    ["description", "Tashkilot haqida", "textarea"],
    ["image", "Logotip", "image"],
    ["phone", "Telefon", "tel"],
    ["email", "Email", "email"],
    ["website", "Sayt havolasi", "url"],
    ["verified", "Tekshirilgan tashkilot", "checkbox"],
  ],
  athlete: [
    ["name", "Ism-familiya"],
    ["city", "Shahar"],
    ["sport", "Sport turi", "sport"],
    ["bio", "Sportchi haqida", "textarea"],
    ["image", "Surat", "image"],
  ],
  team: [
    ["name", "Jamoa nomi"],
    ["city", "Shahar"],
    ["sport", "Sport turi", "sport"],
    ["image", "Jamoa logotipi", "image"],
    ["players", "Jamoa sportchilari", "players"],
  ],
  ad: [
    ["name", "Kampaniya nomi"],
    ["title", "Banner sarlavhasi"],
    ["subtitle", "Izoh", "textarea"],
    ["image", "Banner rasmi", "image"],
    ["url", "O‘tish havolasi"],
    ["buttonLabel", "Tugma matni"],
    [
      "slot",
      "Joylashuv",
      "select",
      "hero:Bosh sahifa yuqorisi,banner:Keng banner,sidebar:Ichki sahifalar",
    ],
    [
      "status",
      "Holat",
      "select",
      "draft:Qoralama,active:Faol,paused:To‘xtatilgan",
    ],
    ["startDate", "Boshlanish", "date"],
    ["endDate", "Tugash", "date"],
    ["priority", "Ustuvorlik (0–100)", "number"],
  ],
  sponsor: [
    ["name", "Hamkor nomi"],
    ["image", "Logotip", "image"],
    ["url", "Sayt havolasi"],
    ["active", "Saytda ko‘rsatish", "checkbox"],
  ],
  settings: [
    ["name", "Sayt nomi"],
    ["tagline", "Qisqa shior"],
    ["heroTitle", "Bosh sahifa sarlavhasi"],
    ["heroSubtitle", "Bosh sahifa izohi", "textarea"],
    ["heroImage", "Bosh sahifa rasmi", "image"],
    ["about", "Biz haqimizda", "textarea"],
    ["contactEmail", "Aloqa email", "email"],
    ["contactPhone", "Aloqa telefoni", "tel"],
    ["telegram", "Telegram havolasi"],
    ["instagram", "Instagram havolasi"],
    ["terms", "Foydalanish shartlari", "textarea"],
    ["privacy", "Maxfiylik siyosati", "textarea"],
    ["winPoints", "G‘alaba uchun ochko", "number"],
    ["drawPoints", "Durang uchun ochko", "number"],
  ],
};
export function ImagePicker({
  value,
  onChange,
  label = "Rasm",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="kp-image-picker">
      <div className="kp-image-preview">
        {value ? (
          <img src={value} alt={label} />
        ) : (
          <span>Rasm tanlanmagan</span>
        )}
      </div>
      <label className="kp-btn secondary">
        {busy ? "Yuklanmoqda…" : "Rasm yuklash"}
        <input
          type="file"
          hidden
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            setError("");
            try {
              onChange(await uploadFile(f));
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {value && (
        <button className="kp-link" type="button" onClick={() => onChange("")}>
          Rasmni olib tashlash
        </button>
      )}
      <small>
        Asl sifat saqlanadi. Muqova va bannerlar uchun kamida 1600 px tavsiya
        qilinadi. 10 MB gacha.
      </small>
      {error && (
        <p role="alert" className="kp-alert error">
          {error}
        </p>
      )}
      <details>
        <summary>Sport rasmlari kutubxonasi</summary>
        <div className="kp-media-choices">
          {[
            "football",
            "tennis",
            "basketball",
            "padel",
            "volleyball",
            "sport",
          ].map((n) => (
            <button
              type="button"
              key={n}
              aria-label={n + " rasmini tanlash"}
              onClick={() => onChange("/media/" + n + ".webp")}
            >
              <img src={"/media/" + n + "-480.webp"} alt={n} />
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
export default function EntityEditor({
  kind,
  initial,
  bootstrap,
  onSaved,
  onCancel,
}: {
  kind: string;
  initial?: E;
  bootstrap: E;
  onSaved: (e: E) => void;
  onCancel?: () => void;
}) {
  const [v, setV] = useState<E>({ ...blanks[kind], ...initial }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const isAdmin = bootstrap.user?.role === "admin";
  const set = (k: string, value: any) => setV((s) => ({ ...s, [k]: value }));
  return (
    <form
      className="kp-form kp-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setBusy(true);
        try {
          const result = await requestApi("entity-save", {
            kind,
            data: v,
            ...(initial?.updatedAt
              ? { expectedUpdatedAt: initial.updatedAt }
              : {}),
          });
          onSaved(result);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="kp-section-title">
        <h2>
          {kindLabels[kind]} {initial?.id ? "tahrirlash" : "yaratish"}
        </h2>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="kp-icon-btn"
            aria-label="Yopish"
          >
            ✕
          </button>
        )}
      </div>
      <div className="kp-form-grid">
        {(fieldDefs[kind] || [])
          .filter(([key]: string[]) => key !== "verified" || isAdmin)
          .map(([key, label, type = "text", opts = ""]: string[]) => {
            const full = ["textarea", "image", "players"].includes(type);
            return (
              <div className={full ? "full" : ""} key={key}>
                {type === "image" ? (
                  <>
                    <span className="kp-label">{label}</span>
                    <ImagePicker
                      value={v[key] || ""}
                      onChange={(url) => set(key, url)}
                      label={label}
                    />
                  </>
                ) : type === "players" ? (
                  <fieldset>
                    <legend>{label}</legend>
                    <div className="kp-check-grid">
                      {bootstrap.athletes?.length ? (
                        bootstrap.athletes.map((a: E) => (
                          <label key={a.id}>
                            <input
                              type="checkbox"
                              checked={(v.players || []).includes(a.id)}
                              onChange={(e) =>
                                set(
                                  "players",
                                  e.target.checked
                                    ? [...(v.players || []), a.id]
                                    : v.players.filter(
                                        (id: string) => id !== a.id,
                                      ),
                                )
                              }
                            />
                            {a.name}
                          </label>
                        ))
                      ) : (
                        <small>Hali sportchi profillari yo‘q.</small>
                      )}
                    </div>
                  </fieldset>
                ) : type === "checkbox" ? (
                  <label className="kp-checkbox">
                    <input
                      type="checkbox"
                      checked={!!v[key]}
                      onChange={(e) => set(key, e.target.checked)}
                    />
                    {label}
                  </label>
                ) : (
                  <label>
                    {label}
                    {type === "textarea" ? (
                      <textarea
                        rows={key === "terms" || key === "privacy" ? 10 : 4}
                        value={v[key] || ""}
                        onChange={(e) => set(key, e.target.value)}
                      />
                    ) : ["select", "sport", "organizer"].includes(type) ? (
                      <select
                        required={key === "organizerId" && v.status !== "draft"}
                        value={v[key] ?? ""}
                        onChange={(e) => set(key, e.target.value)}
                      >
                        {type === "organizer" ? (
                          <>
                            <option value="">Tashkilotchini tanlang</option>
                            {(isAdmin
                              ? bootstrap.organizers
                              : bootstrap.myOrganizers
                            )?.map((o: E) => (
                              <option value={o.id} key={o.id}>
                                {o.name}
                              </option>
                            ))}
                          </>
                        ) : type === "sport" ? (
                          [
                            "Futbol",
                            "Tennis",
                            "Basketbol",
                            "Voleybol",
                            "Padel",
                            "Bilyard",
                            "Boks",
                            "Boshqa",
                          ].map((x) => <option key={x}>{x}</option>)
                        ) : (
                          opts.split(",").map((o) => {
                            const [k, t] = o.split(":");
                            return (
                              <option value={k} key={k}>
                                {t}
                              </option>
                            );
                          })
                        )}
                      </select>
                    ) : (
                      <input
                        type={type === "url" ? "text" : type}
                        value={v[key] ?? ""}
                        min={type === "number" ? 0 : undefined}
                        maxLength={type === "text" ? 150 : undefined}
                        required={[
                          "name",
                          "title",
                          "city",
                          "sport",
                          "capacity",
                        ].includes(key)}
                        onChange={(e) =>
                          set(
                            key,
                            type === "number"
                              ? Number(e.target.value)
                              : e.target.value,
                          )
                        }
                      />
                    )}
                  </label>
                )}
              </div>
            );
          })}
      </div>
      {kind === "tournament" && !bootstrap.myOrganizers?.length && !isAdmin && (
        <p className="kp-alert">
          E’lon qilish uchun avval{" "}
          <a href="/tashkilotchi-yaratish">tashkilotchi profilini yarating</a>.
        </p>
      )}
      {kind === "tournament" && v.price > 0 && (
        <p className="kp-alert">
          To‘lov provayderi ulanmagan. Pullik arizalar to‘lov kutilmoqda
          holatida qoladi.
        </p>
      )}
      {error && (
        <p className="kp-alert error" role="alert">
          {error}
        </p>
      )}
      <div className="kp-form-actions">
        <button className="kp-btn" disabled={busy}>
          {busy ? "Saqlanmoqda…" : "Saqlash"}
        </button>
        {onCancel && (
          <button type="button" className="kp-btn secondary" onClick={onCancel}>
            Bekor qilish
          </button>
        )}
      </div>
    </form>
  );
}
