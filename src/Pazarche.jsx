import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search, MapPin, Heart, Plus, ChevronLeft, Phone, Mail,
  Tag, Clock, Filter, Trash2, Check
} from "lucide-react";

/* ============================================================
   ПАЗАРЧЕ — безплатни обяви
   Палитра: мастило #16130F, амбър #E8A33D, кайсия #F4EBDD,
            горчица #C9762B, зелено #3C6E47
   Шрифтове: display = "Bricolage Grotesque"-усещане чрез тежки
            sans тегла; body = system sans
   ============================================================ */

const CATEGORIES = [
  { id: "all", label: "Всички", icon: "🗂️" },
  { id: "imoti", label: "Имоти", icon: "🏠" },
  { id: "avto", label: "Автомобили", icon: "🚗" },
  { id: "tehnika", label: "Техника", icon: "📱" },
  { id: "moda", label: "Мода", icon: "👕" },
  { id: "dom", label: "Дом и градина", icon: "🪴" },
  { id: "deca", label: "За детето", icon: "🧸" },
  { id: "uslugi", label: "Услуги", icon: "🔧" },
  { id: "rabota", label: "Работа", icon: "💼" },
  { id: "hobi", label: "Хоби и спорт", icon: "🎸" },
  { id: "jivotni", label: "Животни", icon: "🐾" },
];

const CITIES = [
  "Цяла България", "София", "Пловдив", "Варна", "Бургас", "Русе",
  "Стара Загора", "Плевен", "Велико Търново", "Благоевград", "Хасково",
];

const COND = ["Ново", "Като ново", "Употребявано", "За части"];

const SAMPLE = [
  { id: "s1", title: "Тристаен апартамент, кв. Лозенец", cat: "imoti", price: 189000, city: "София", cond: "Като ново", desc: "Светъл тристаен апартамент с южно изложение, 92 кв.м, обзаведен, гараж. Близо до градинка и метро.", phone: "0888 123 456", email: "ivan@example.bg", name: "Иван П.", photos: ["#C9762B"], created: Date.now() - 3600e3 * 5 },
  { id: "s2", title: "VW Golf 7, 2017, дизел", cat: "avto", price: 18900, city: "Пловдив", cond: "Употребявано", desc: "Голф 7, 1.6 TDI, 110 к.с., обслужван в сервиз, нови гуми, без забележки. Реални километри.", phone: "0899 555 777", email: "auto@example.bg", name: "Георги М.", photos: ["#3C6E47"], created: Date.now() - 3600e3 * 26 },
  { id: "s3", title: "iPhone 14 Pro, 256GB", cat: "tehnika", price: 1450, city: "Варна", cond: "Като ново", desc: "Тъмно лилав, батерия 96%, с кутия и зарядно. Гаранция още 4 месеца.", phone: "0877 333 222", email: "tech@example.bg", name: "Мария К.", photos: ["#16130F"], created: Date.now() - 3600e3 * 50 },
  { id: "s4", title: "Детска количка 3 в 1", cat: "deca", price: 320, city: "Бургас", cond: "Употребявано", desc: "Cybex, пълен комплект — кош, седалка, кошче за кола. Запазена, малко ползвана.", phone: "0898 111 000", email: "deca@example.bg", name: "Елена С.", photos: ["#E8A33D"], created: Date.now() - 3600e3 * 72 },
  { id: "s5", title: "Майстор — ремонт на бани", cat: "uslugi", price: 0, city: "София", cond: "Ново", desc: "Цялостни ремонти на бани и санитарни помещения. Гипсокартон, фаянс, ВиК. Безплатен оглед.", phone: "0876 909 909", email: "remont@example.bg", name: "Стефан Д.", photos: ["#3C6E47"], created: Date.now() - 3600e3 * 8 },
  { id: "s6", title: "Електрическа китара Fender", cat: "hobi", price: 980, city: "Русе", cond: "Като ново", desc: "Fender Player Stratocaster, sunburst, с калъф и ремък. Звук — мечта.", phone: "0883 404 404", email: "music@example.bg", name: "Никола В.", photos: ["#C9762B"], created: Date.now() - 3600e3 * 14 },
];

const fmtPrice = (p) => p === 0 ? "По договаряне" : new Intl.NumberFormat("bg-BG").format(p) + " лв.";
const fmtTime = (t) => {
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 60) return `преди ${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `преди ${h} ч`;
  const d = Math.floor(h / 24);
  return `преди ${d} дни`;
};

function useIsMobile() {
  const [m, setM] = useState(typeof window !== "undefined" ? window.innerWidth < 720 : false);
  useEffect(() => {
    const on = () => setM(window.innerWidth < 720);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return m;
}

export default function Pazarche() {
  const isMobile = useIsMobile();
  const [listings, setListings] = useState([]);
  const [favs, setFavs] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const [cat, setCat] = useState("all");
  const [city, setCity] = useState("Цяла България");
  const [q, setQ] = useState("");
  const [minP, setMinP] = useState("");
  const [maxP, setMaxP] = useState("");
  const [sort, setSort] = useState("new");
  const [showFavsOnly, setShowFavsOnly] = useState(false);

  const [detail, setDetail] = useState(null);
  const [posting, setPosting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // load persisted data (localStorage — works on any host)
  useEffect(() => {
    try {
      const l = localStorage.getItem("pz_listings");
      setListings(l ? JSON.parse(l) : SAMPLE);
    } catch { setListings(SAMPLE); }
    try {
      const f = localStorage.getItem("pz_favs");
      if (f) setFavs(JSON.parse(f));
    } catch {}
    setLoaded(true);
  }, []);

  const persist = useCallback((next) => {
    setListings(next);
    try { localStorage.setItem("pz_listings", JSON.stringify(next)); } catch {}
  }, []);

  const toggleFav = useCallback((id) => {
    setFavs((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem("pz_favs", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const addListing = useCallback((data) => {
    const item = { ...data, id: "u" + Date.now(), created: Date.now() };
    persist([item, ...listings]);
    setPosting(false);
    setCat("all"); setCity("Цяла България"); setQ(""); setShowFavsOnly(false);
  }, [listings, persist]);

  const removeListing = useCallback((id) => {
    persist(listings.filter((l) => l.id !== id));
    setDetail(null);
  }, [listings, persist]);

  const filtered = useMemo(() => {
    let r = listings.filter((l) => {
      if (cat !== "all" && l.cat !== cat) return false;
      if (city !== "Цяла България" && l.city !== city) return false;
      if (q && !(`${l.title} ${l.desc}`.toLowerCase().includes(q.toLowerCase()))) return false;
      if (minP && l.price < +minP) return false;
      if (maxP && l.price > +maxP) return false;
      if (showFavsOnly && !favs.includes(l.id)) return false;
      return true;
    });
    r = [...r].sort((a, b) =>
      sort === "new" ? b.created - a.created
      : sort === "low" ? a.price - b.price
      : b.price - a.price
    );
    return r;
  }, [listings, cat, city, q, minP, maxP, sort, showFavsOnly, favs]);

  const activeFilters = (cat !== "all") + (city !== "Цяла България") + (!!minP) + (!!maxP) + showFavsOnly;

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", background: "#F4EBDD", display: "grid", placeItems: "center", fontFamily: "system-ui" }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#16130F", letterSpacing: "-0.02em" }}>Пазарче…</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F4EBDD", color: "#16130F", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; }
        @media (prefers-reduced-motion: reduce){ *{animation:none!important;transition:none!important} }
        .pz-card{ transition: transform .18s ease, box-shadow .18s ease; }
        .pz-card:hover{ transform: translateY(-3px); box-shadow: 0 12px 28px rgba(22,19,15,.16); }
        .pz-cat:hover{ background:#16130F; color:#F4EBDD; }
        .pz-btn:active{ transform: scale(.97); }
        button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible{ outline: 3px solid #E8A33D; outline-offset: 2px; }
        input, select, textarea{ font-family: inherit; }
        ::placeholder{ color:#9c8f7d; }
        .pz-row2{ display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        @media (max-width:600px){ .pz-row2{ grid-template-columns:1fr; } }
      `}</style>

      {/* HEADER */}
      <header style={{ background: "#16130F", color: "#F4EBDD", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: isMobile ? "11px 14px" : "14px 18px", display: "flex", alignItems: "center", gap: isMobile ? 10 : 18, flexWrap: "wrap" }}>
          <div onClick={() => { setDetail(null); setPosting(false); }} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "#E8A33D", display: "grid", placeItems: "center", color: "#16130F", fontWeight: 900, fontSize: 20 }}>П</div>
            <span style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-0.03em" }}>Пазарче</span>
          </div>
          {!isMobile && (
            <div style={{ flex: 1, position: "relative", maxWidth: 520 }}>
              <Search size={18} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#9c8f7d" }} />
              <input
                value={q} onChange={(e) => { setQ(e.target.value); setDetail(null); setPosting(false); }}
                placeholder="Какво търсиш?"
                style={{ width: "100%", padding: "11px 14px 11px 40px", borderRadius: 11, border: "none", fontSize: 15, background: "#F4EBDD", color: "#16130F" }}
              />
            </div>
          )}
          <div style={{ flex: isMobile ? "unset" : 0, marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={() => { setShowFavsOnly((s) => !s); setDetail(null); setPosting(false); }}
              className="pz-btn"
              aria-label="Любими"
              style={{ background: showFavsOnly ? "#E8A33D" : "transparent", color: showFavsOnly ? "#16130F" : "#F4EBDD", border: "1.5px solid #E8A33D", borderRadius: 11, padding: "9px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 14, minHeight: 44 }}>
              <Heart size={17} fill={showFavsOnly ? "#16130F" : "none"} /> <span style={{ display: favs.length ? "inline" : "none" }}>{favs.length}</span>
            </button>
            <button onClick={() => { setPosting(true); setDetail(null); }}
              className="pz-btn"
              aria-label="Добави обява"
              style={{ background: "#E8A33D", color: "#16130F", border: "none", borderRadius: 11, padding: isMobile ? "9px 13px" : "10px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontWeight: 800, fontSize: 14, whiteSpace: "nowrap", minHeight: 44 }}>
              <Plus size={18} /> {!isMobile && "Добави обява"}
            </button>
          </div>
          {isMobile && (
            <div style={{ flexBasis: "100%", position: "relative" }}>
              <Search size={18} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#9c8f7d" }} />
              <input
                value={q} onChange={(e) => { setQ(e.target.value); setDetail(null); setPosting(false); }}
                placeholder="Какво търсиш?"
                style={{ width: "100%", padding: "12px 14px 12px 40px", borderRadius: 11, border: "none", fontSize: 16, background: "#F4EBDD", color: "#16130F" }}
              />
            </div>
          )}
        </div>
      </header>

      {/* CATEGORY STRIP */}
      {!detail && !posting && (
        <div style={{ background: "#fff", borderBottom: "1px solid #e6dcc9", position: "sticky", top: isMobile ? 112 : 64, zIndex: 30, overflowX: "auto" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", padding: "10px 18px", display: "flex", gap: 8 }}>
            {CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} className="pz-cat"
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 999, border: "1.5px solid", borderColor: cat === c.id ? "#16130F" : "#e6dcc9", background: cat === c.id ? "#16130F" : "#fff", color: cat === c.id ? "#F4EBDD" : "#16130F", cursor: "pointer", fontWeight: 600, fontSize: 14, whiteSpace: "nowrap" }}>
                <span>{c.icon}</span> {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "0 18px 60px" }}>
        {posting ? (
          <PostForm onSubmit={addListing} onCancel={() => setPosting(false)} />
        ) : detail ? (
          <Detail item={detail} onBack={() => setDetail(null)} isFav={favs.includes(detail.id)} onFav={() => toggleFav(detail.id)} onRemove={removeListing} isMobile={isMobile} />
        ) : (
          <>
            {/* HERO — only when no search/filter active */}
            {activeFilters === 0 && !q && (
              <section style={{ padding: "44px 0 28px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.14em", color: "#C9762B", textTransform: "uppercase", marginBottom: 10 }}>Безплатни обяви · Цяла България</div>
                <h1 style={{ fontSize: "clamp(32px, 5vw, 54px)", lineHeight: 1.02, margin: 0, fontWeight: 800, letterSpacing: "-0.03em", maxWidth: 760 }}>
                  Купувай и продавай <span style={{ color: "#C9762B" }}>между съседи</span> — без комисиона.
                </h1>
                <p style={{ fontSize: 17, color: "#5c5345", marginTop: 14, maxWidth: 560 }}>
                  {listings.length} активни обяви в {CATEGORIES.length - 1} категории. Публикуването е безплатно и отнема минута.
                </p>
              </section>
            )}

            {/* CONTROLS BAR */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
                {showFavsOnly ? "Любими обяви" : CATEGORIES.find((c) => c.id === cat)?.label}
                <span style={{ color: "#9c8f7d", fontWeight: 600 }}> · {filtered.length}</span>
              </h2>
              <div style={{ flex: 1 }} />
              <button onClick={() => setShowFilters((s) => !s)} className="pz-btn"
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 10, border: "1.5px solid #16130F", background: showFilters ? "#16130F" : "#fff", color: showFilters ? "#F4EBDD" : "#16130F", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
                <Filter size={16} /> Филтри {activeFilters > 0 && <span style={{ background: "#E8A33D", color: "#16130F", borderRadius: 999, padding: "0 7px", fontSize: 12 }}>{activeFilters}</span>}
              </button>
              <select value={sort} onChange={(e) => setSort(e.target.value)}
                style={{ padding: "9px 12px", borderRadius: 10, border: "1.5px solid #e6dcc9", background: "#fff", color: "#16130F", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                <option value="new">Най-нови</option>
                <option value="low">Цена ↑</option>
                <option value="high">Цена ↓</option>
              </select>
            </div>

            {/* FILTER PANEL */}
            {showFilters && (
              <div style={{ background: "#fff", border: "1px solid #e6dcc9", borderRadius: 14, padding: 18, marginBottom: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
                <Field label="Град">
                  <select value={city} onChange={(e) => setCity(e.target.value)} style={inp}>
                    {CITIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Цена от">
                  <input type="number" value={minP} onChange={(e) => setMinP(e.target.value)} placeholder="0" style={inp} />
                </Field>
                <Field label="Цена до">
                  <input type="number" value={maxP} onChange={(e) => setMaxP(e.target.value)} placeholder="—" style={inp} />
                </Field>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button onClick={() => { setCity("Цяла България"); setMinP(""); setMaxP(""); setCat("all"); setShowFavsOnly(false); }}
                    style={{ padding: "11px 14px", borderRadius: 10, border: "1.5px solid #C9762B", background: "#fff", color: "#C9762B", fontWeight: 700, cursor: "pointer", width: "100%" }}>
                    Изчисти филтрите
                  </button>
                </div>
              </div>
            )}

            {/* GRID */}
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "70px 20px", color: "#5c5345" }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>🔍</div>
                <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 6 }}>Няма намерени обяви</div>
                <p style={{ margin: "0 0 18px" }}>Опитай с друга категория или махни част от филтрите.</p>
                <button onClick={() => setPosting(true)} style={{ background: "#E8A33D", color: "#16130F", border: "none", borderRadius: 10, padding: "11px 18px", fontWeight: 800, cursor: "pointer" }}>
                  Добави първата обява
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(248px, 1fr))", gap: 16 }}>
                {filtered.map((l) => (
                  <Card key={l.id} item={l} fav={favs.includes(l.id)} onFav={() => toggleFav(l.id)} onOpen={() => setDetail(l)} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <footer style={{ background: "#16130F", color: "#9c8f7d", padding: "30px 18px", marginTop: 20 }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ color: "#F4EBDD", fontWeight: 800, fontSize: 18 }}>Пазарче</div>
          <div style={{ fontSize: 14 }}>Безплатни обяви за цяла България · {new Date().getFullYear()}</div>
        </div>
      </footer>
    </div>
  );
}

const inp = { width: "100%", padding: "11px 12px", borderRadius: 10, border: "1.5px solid #e6dcc9", background: "#F4EBDD", fontSize: 15, color: "#16130F" };

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: "#5c5345" }}>{label}</span>
      {children}
    </label>
  );
}

function Card({ item, fav, onFav, onOpen }) {
  const bg = item.photos?.[0] || "#C9762B";
  const catObj = CATEGORIES.find((c) => c.id === item.cat);
  return (
    <article className="pz-card" onClick={onOpen}
      style={{ background: "#fff", borderRadius: 16, overflow: "hidden", cursor: "pointer", border: "1px solid #e6dcc9" }}>
      <div style={{ height: 160, background: bg, position: "relative", display: "grid", placeItems: "center" }}>
        <span style={{ fontSize: 46, opacity: 0.9 }}>{catObj?.icon}</span>
        <button onClick={(e) => { e.stopPropagation(); onFav(); }} aria-label="Запази в любими"
          style={{ position: "absolute", top: 10, right: 10, width: 36, height: 36, borderRadius: 999, border: "none", background: "rgba(255,255,255,.92)", display: "grid", placeItems: "center", cursor: "pointer" }}>
          <Heart size={18} fill={fav ? "#C9762B" : "none"} color={fav ? "#C9762B" : "#16130F"} />
        </button>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: "#C9762B", letterSpacing: "-0.02em" }}>{fmtPrice(item.price)}</div>
        <h3 style={{ margin: "4px 0 8px", fontSize: 15.5, fontWeight: 600, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 40 }}>{item.title}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#9c8f7d" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}><MapPin size={13} /> {item.city}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Clock size={13} /> {fmtTime(item.created)}</span>
        </div>
      </div>
    </article>
  );
}

function Detail({ item, onBack, isFav, onFav, onRemove, isMobile }) {
  const bg = item.photos?.[0] || "#C9762B";
  const catObj = CATEGORIES.find((c) => c.id === item.cat);
  const isUser = item.id.startsWith("u");
  return (
    <div style={{ padding: "20px 0 0" }}>
      <button onClick={onBack} className="pz-btn"
        style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "#5c5345", cursor: "pointer", fontWeight: 700, fontSize: 15, marginBottom: 16, padding: "6px 0", minHeight: 44 }}>
        <ChevronLeft size={19} /> Назад към обявите
      </button>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1.5fr) minmax(0,1fr)", gap: 24, alignItems: "start" }}>
        <div>
          <div style={{ height: isMobile ? 240 : 360, background: bg, borderRadius: 18, display: "grid", placeItems: "center", position: "relative" }}>
            <span style={{ fontSize: isMobile ? 72 : 96, opacity: 0.92 }}>{catObj?.icon}</span>
            <span style={{ position: "absolute", top: 14, left: 14, background: "rgba(244,235,221,.95)", padding: "5px 12px", borderRadius: 999, fontWeight: 700, fontSize: 13 }}>{catObj?.label}</span>
          </div>
          <div style={{ background: "#fff", borderRadius: 16, padding: 22, marginTop: 16, border: "1px solid #e6dcc9" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 800 }}>Описание</h3>
            <p style={{ margin: 0, lineHeight: 1.65, color: "#3a342b", whiteSpace: "pre-wrap" }}>{item.desc}</p>
          </div>
        </div>
        <aside style={{ position: isMobile ? "static" : "sticky", top: 130 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 22, border: "1px solid #e6dcc9" }}>
            <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800, lineHeight: 1.2, letterSpacing: "-0.02em" }}>{item.title}</h1>
            <div style={{ fontSize: 30, fontWeight: 900, color: "#C9762B", letterSpacing: "-0.02em" }}>{fmtPrice(item.price)}</div>
            <div style={{ display: "flex", gap: 14, margin: "14px 0", flexWrap: "wrap", fontSize: 14, color: "#5c5345" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={15} /> {item.city}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Tag size={15} /> {item.cond}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={15} /> {fmtTime(item.created)}</span>
            </div>
            <div style={{ borderTop: "1px solid #eee3d2", paddingTop: 16, marginTop: 4 }}>
              <div style={{ fontSize: 13, color: "#9c8f7d", fontWeight: 700 }}>Продавач</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{item.name}</div>
              <a href={`tel:${item.phone}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#16130F", color: "#F4EBDD", textDecoration: "none", borderRadius: 11, padding: "13px", fontWeight: 800, fontSize: 15, marginBottom: 9 }}>
                <Phone size={18} /> {item.phone}
              </a>
              <a href={`mailto:${item.email}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#fff", color: "#16130F", textDecoration: "none", border: "1.5px solid #16130F", borderRadius: 11, padding: "12px", fontWeight: 800, fontSize: 15 }}>
                <Mail size={18} /> Изпрати имейл
              </a>
            </div>
            <button onClick={onFav} className="pz-btn"
              style={{ width: "100%", marginTop: 9, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: isFav ? "#F4EBDD" : "#fff", border: "1.5px solid #C9762B", color: "#C9762B", borderRadius: 11, padding: "12px", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
              <Heart size={18} fill={isFav ? "#C9762B" : "none"} /> {isFav ? "В любими" : "Запази"}
            </button>
            {isUser && (
              <button onClick={() => onRemove(item.id)}
                style={{ width: "100%", marginTop: 9, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, background: "none", border: "none", color: "#a04030", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                <Trash2 size={16} /> Изтрий обявата
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function PostForm({ onSubmit, onCancel }) {
  const [f, setF] = useState({ title: "", cat: "tehnika", price: "", city: "София", cond: "Употребявано", desc: "", name: "", phone: "", email: "", photos: ["#E8A33D"] });
  const [err, setErr] = useState({});
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const SWATCHES = ["#E8A33D", "#C9762B", "#3C6E47", "#16130F", "#7a5cc4", "#3a7bd5"];

  const submit = () => {
    const e = {};
    if (!f.title.trim()) e.title = "Въведи заглавие";
    if (!f.desc.trim()) e.desc = "Добави описание";
    if (!f.name.trim()) e.name = "Въведи име";
    if (!f.phone.trim()) e.phone = "Въведи телефон";
    setErr(e);
    if (Object.keys(e).length) return;
    onSubmit({ ...f, price: f.price === "" ? 0 : +f.price });
  };

  return (
    <div style={{ padding: "24px 0 0", maxWidth: 720, margin: "0 auto" }}>
      <button onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "#5c5345", cursor: "pointer", fontWeight: 700, fontSize: 15, marginBottom: 16, padding: 0 }}>
        <ChevronLeft size={19} /> Отказ
      </button>
      <h1 style={{ fontSize: 30, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.03em" }}>Нова обява</h1>
      <p style={{ color: "#5c5345", marginTop: 0, marginBottom: 22 }}>Попълни полетата. Обявата се публикува веднага и безплатно.</p>

      <div style={{ background: "#fff", borderRadius: 16, padding: 22, border: "1px solid #e6dcc9", display: "grid", gap: 16 }}>
        <Field label="Заглавие *">
          <input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="напр. iPhone 14 Pro, 256GB" style={{ ...inp, borderColor: err.title ? "#a04030" : "#e6dcc9" }} />
          {err.title && <Err>{err.title}</Err>}
        </Field>

        <div className="pz-row2">
          <Field label="Категория">
            <select value={f.cat} onChange={(e) => set("cat", e.target.value)} style={inp}>
              {CATEGORIES.filter((c) => c.id !== "all").map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </select>
          </Field>
          <Field label="Състояние">
            <select value={f.cond} onChange={(e) => set("cond", e.target.value)} style={inp}>
              {COND.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>

        <div className="pz-row2">
          <Field label="Цена (лв.) — празно = по договаряне">
            <input type="number" value={f.price} onChange={(e) => set("price", e.target.value)} placeholder="По договаряне" style={inp} />
          </Field>
          <Field label="Град">
            <select value={f.city} onChange={(e) => set("city", e.target.value)} style={inp}>
              {CITIES.filter((c) => c !== "Цяла България").map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Снимка (избери цвят-плочка)">
          <div style={{ display: "flex", gap: 10 }}>
            {SWATCHES.map((s) => (
              <button key={s} onClick={() => set("photos", [s])} aria-label="Избор на плочка"
                style={{ width: 42, height: 42, borderRadius: 10, background: s, border: f.photos[0] === s ? "3px solid #16130F" : "2px solid #e6dcc9", cursor: "pointer", display: "grid", placeItems: "center" }}>
                {f.photos[0] === s && <Check size={18} color="#fff" />}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Описание *">
          <textarea value={f.desc} onChange={(e) => set("desc", e.target.value)} rows={4} placeholder="Опиши какво продаваш — състояние, детайли, причина за продажба…" style={{ ...inp, resize: "vertical", borderColor: err.desc ? "#a04030" : "#e6dcc9" }} />
          {err.desc && <Err>{err.desc}</Err>}
        </Field>

        <div style={{ borderTop: "1px solid #eee3d2", paddingTop: 16, display: "grid", gap: 14 }}>
          <Field label="Твоето име *">
            <input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Иван П." style={{ ...inp, borderColor: err.name ? "#a04030" : "#e6dcc9" }} />
            {err.name && <Err>{err.name}</Err>}
          </Field>
          <div className="pz-row2">
            <Field label="Телефон *">
              <input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0888 123 456" style={{ ...inp, borderColor: err.phone ? "#a04030" : "#e6dcc9" }} />
              {err.phone && <Err>{err.phone}</Err>}
            </Field>
            <Field label="Имейл">
              <input value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="ivan@example.bg" style={inp} />
            </Field>
          </div>
        </div>

        <button onClick={submit} className="pz-btn"
          style={{ background: "#E8A33D", color: "#16130F", border: "none", borderRadius: 12, padding: "15px", fontWeight: 800, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Check size={20} /> Публикувай обявата
        </button>
      </div>
    </div>
  );
}

function Err({ children }) {
  return <span style={{ color: "#a04030", fontSize: 13, fontWeight: 600, marginTop: 5, display: "block" }}>{children}</span>;
}
