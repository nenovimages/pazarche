import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search, MapPin, Heart, Plus, ChevronLeft, Phone, Mail,
  Tag, Clock, Filter, Trash2, Check, LogOut, User, ImagePlus, X, Pencil, MessageCircle
} from "lucide-react";
import { supabase } from "./supabase";
import { ConversationList, ChatView, startConversation, getUnreadCount } from "./Messages";

/* ============================================================
   ПАЗАРЧЕ — безплатни обяви (със Supabase: акаунти + обща база)
   Палитра: мастило #16130F, амбър #E8A33D, кайсия #F4EBDD,
            горчица #C9762B, зелено #3C6E47
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

// Координати на градовете (ширина, дължина) — за търсене по близост
const CITY_COORDS = {
  "София": [42.6977, 23.3219],
  "Пловдив": [42.1354, 24.7453],
  "Варна": [43.2141, 27.9147],
  "Бургас": [42.5048, 27.4626],
  "Русе": [43.8356, 25.9657],
  "Стара Загора": [42.4258, 25.6345],
  "Плевен": [43.4170, 24.6067],
  "Велико Търново": [43.0757, 25.6172],
  "Благоевград": [42.0117, 23.0947],
  "Хасково": [41.9344, 25.5554],
};

const RADIUS_OPTIONS = [
  { v: 0, label: "Без значение" },
  { v: 30, label: "до 30 км" },
  { v: 60, label: "до 60 км" },
  { v: 100, label: "до 100 км" },
  { v: 200, label: "до 200 км" },
];

// Разстояние между две точки в км (формула на хаверсин)
function distanceKm(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLon = (b[1] - a[1]) * Math.PI / 180;
  const lat1 = a[0] * Math.PI / 180;
  const lat2 = b[0] * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const COND = ["Ново", "Като ново", "Употребявано", "За части"];

const fmtPrice = (p) => p === 0 ? "По договаряне" : new Intl.NumberFormat("bg-BG").format(p) + " лв.";
const fmtTime = (iso) => {
  const t = new Date(iso).getTime();
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return "току-що";
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

const inp = { width: "100%", padding: "11px 12px", borderRadius: 10, border: "1.5px solid #e6dcc9", background: "#F4EBDD", fontSize: 15, color: "#16130F" };

export default function Pazarche() {
  const isMobile = useIsMobile();
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [listings, setListings] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [favs, setFavs] = useState([]);

  const [cat, setCat] = useState("all");
  const [city, setCity] = useState("Цяла България");
  const [radius, setRadius] = useState(0);
  const [q, setQ] = useState("");
  const [minP, setMinP] = useState("");
  const [maxP, setMaxP] = useState("");
  const [sort, setSort] = useState("new");
  const [showFavsOnly, setShowFavsOnly] = useState(false);

  const [detail, setDetail] = useState(null);
  const [posting, setPosting] = useState(false);
  const [editing, setEditing] = useState(null); // listing being edited
  const [authView, setAuthView] = useState(null); // null | "login" | "signup"
  const [showFilters, setShowFilters] = useState(false);
  const [msgView, setMsgView] = useState(null); // null | "list" | "chat"
  const [activeConv, setActiveConv] = useState(null);
  const [unread, setUnread] = useState(0);
  const [showMineOnly, setShowMineOnly] = useState(false);
  const [hideSold, setHideSold] = useState(false);

  // ---- AUTH ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // ---- favourites (local — лични за устройството) ----
  useEffect(() => {
    try {
      const f = localStorage.getItem("pz_favs");
      if (f) setFavs(JSON.parse(f));
    } catch {}
  }, []);
  const toggleFav = useCallback((id) => {
    setFavs((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem("pz_favs", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // ---- listings from Supabase ----
  const loadListings = useCallback(async () => {
    setLoadingList(true);
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setListings(data);
    setLoadingList(false);
  }, []);

  useEffect(() => { loadListings(); }, [loadListings]);

  const refreshUnread = useCallback(() => {
    if (session?.user?.id) getUnreadCount(session.user.id).then(setUnread);
    else setUnread(0);
  }, [session]);

  useEffect(() => {
    refreshUnread();
    if (!session) return;
    const t = setInterval(refreshUnread, 20000);
    return () => clearInterval(t);
  }, [refreshUnread, session]);

  const addListing = useCallback(async (form, photoUrls) => {
    if (!session) { setAuthView("login"); return { error: "Трябва да влезеш в профила си." }; }
    const row = {
      user_id: session.user.id,
      title: form.title,
      cat: form.cat,
      price: form.price === "" ? 0 : +form.price,
      city: form.city,
      cond: form.cond,
      descr: form.descr,
      phone: form.phone,
      email: form.email || session.user.email,
      seller_name: form.seller_name,
      photo: form.photo,
      photos: photoUrls || [],
    };
    const { data, error } = await supabase.from("listings").insert(row).select().single();
    if (error) return { error: error.message };
    setListings((prev) => [data, ...prev]);
    setPosting(false);
    setCat("all"); setCity("Цяла България"); setQ(""); setShowFavsOnly(false);
    return {};
  }, [session]);

  const removeListing = useCallback(async (id) => {
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (!error) {
      setListings((prev) => prev.filter((l) => l.id !== id));
      setDetail(null);
    }
  }, []);

  const updateListing = useCallback(async (id, form, photoUrls) => {
    if (!session) { setAuthView("login"); return { error: "Трябва да влезеш в профила си." }; }
    const patch = {
      title: form.title,
      cat: form.cat,
      price: form.price === "" ? 0 : +form.price,
      city: form.city,
      cond: form.cond,
      descr: form.descr,
      phone: form.phone,
      email: form.email || session.user.email,
      seller_name: form.seller_name,
      photos: photoUrls || [],
    };
    const { data, error } = await supabase.from("listings").update(patch).eq("id", id).select().single();
    if (error) return { error: error.message };
    setListings((prev) => prev.map((l) => (l.id === id ? data : l)));
    setEditing(null);
    setDetail(data);
    return {};
  }, [session]);

  const toggleSold = useCallback(async (id, sold) => {
    const { data, error } = await supabase.from("listings").update({ sold }).eq("id", id).select().single();
    if (!error && data) {
      setListings((prev) => prev.map((l) => (l.id === id ? data : l)));
      setDetail((d) => (d && d.id === id ? data : d));
    }
  }, []);

  const contactSeller = useCallback(async (listing) => {
    if (!session) { setAuthView("login"); return; }
    const res = await startConversation(listing, session.user.id);
    if (res.id) {
      setActiveConv({ id: res.id, listings: { title: listing.title } });
      setDetail(null);
      setMsgView("chat");
    }
  }, [session]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
  }, []);

  const filtered = useMemo(() => {
    const originCoord = city !== "Цяла България" ? CITY_COORDS[city] : null;
    let r = listings.filter((l) => {
      if (showMineOnly && l.user_id !== session?.user?.id) return false;
      if (cat !== "all" && l.cat !== cat) return false;
      // локация: с радиус → по разстояние; без радиус → точен град
      if (city !== "Цяла България") {
        if (radius > 0 && originCoord) {
          const d = distanceKm(originCoord, CITY_COORDS[l.city]);
          if (d > radius) return false;
        } else if (l.city !== city) {
          return false;
        }
      }
      if (q && !(`${l.title} ${l.descr}`.toLowerCase().includes(q.toLowerCase()))) return false;
      if (minP && l.price < +minP) return false;
      if (maxP && l.price > +maxP) return false;
      if (showFavsOnly && !favs.includes(l.id)) return false;
      if (hideSold && l.sold) return false;
      return true;
    });
    r = [...r].sort((a, b) => {
      if (sort === "near" && originCoord) {
        return distanceKm(originCoord, CITY_COORDS[a.city]) - distanceKm(originCoord, CITY_COORDS[b.city]);
      }
      return sort === "low" ? a.price - b.price
        : sort === "high" ? b.price - a.price
        : new Date(b.created_at) - new Date(a.created_at);
    });
    return r;
  }, [listings, cat, city, radius, q, minP, maxP, sort, showFavsOnly, favs, showMineOnly, session, hideSold]);

  const myCount = useMemo(() =>
    session ? listings.filter((l) => l.user_id === session.user.id).length : 0,
  [listings, session]);

  const activeFilters = (cat !== "all") + (city !== "Цяла България") + (radius > 0) + (!!minP) + (!!maxP) + showFavsOnly;

  const goPost = () => {
    if (!session) { setAuthView("signup"); setDetail(null); return; }
    setPosting(true); setDetail(null);
  };

  if (!authReady) {
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
          <div onClick={() => { setDetail(null); setPosting(false); setAuthView(null); setEditing(null); setMsgView(null); setActiveConv(null); }} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "#E8A33D", display: "grid", placeItems: "center", color: "#16130F", fontWeight: 900, fontSize: 20 }}>П</div>
            <span style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-0.03em" }}>Пазарче</span>
          </div>
          {!isMobile && (
            <div style={{ flex: 1, position: "relative", maxWidth: 520 }}>
              <Search size={18} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#9c8f7d" }} />
              <input value={q} onChange={(e) => { setQ(e.target.value); setDetail(null); setPosting(false); setAuthView(null); }}
                placeholder="Какво търсиш?"
                style={{ width: "100%", padding: "11px 14px 11px 40px", borderRadius: 11, border: "none", fontSize: 15, background: "#F4EBDD", color: "#16130F" }} />
            </div>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => { setShowFavsOnly((s) => !s); setDetail(null); setPosting(false); setAuthView(null); }}
              className="pz-btn" aria-label="Любими"
              style={{ background: showFavsOnly ? "#E8A33D" : "transparent", color: showFavsOnly ? "#16130F" : "#F4EBDD", border: "1.5px solid #E8A33D", borderRadius: 11, padding: "9px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 14, minHeight: 44 }}>
              <Heart size={17} fill={showFavsOnly ? "#16130F" : "none"} /> <span style={{ display: favs.length ? "inline" : "none" }}>{favs.length}</span>
            </button>
            {session ? (
              <>
                <button onClick={() => { setShowMineOnly((s) => !s); setShowFavsOnly(false); setDetail(null); setPosting(false); setAuthView(null); }}
                  className="pz-btn" aria-label="Моите обяви"
                  style={{ background: showMineOnly ? "#E8A33D" : "transparent", color: showMineOnly ? "#16130F" : "#F4EBDD", border: "1.5px solid #4a4339", borderColor: showMineOnly ? "#E8A33D" : "#4a4339", borderRadius: 11, padding: "9px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 14, minHeight: 44, whiteSpace: "nowrap" }}>
                  <User size={16} /> {isMobile ? `(${myCount})` : `Моите обяви (${myCount})`}
                </button>
                {!isMobile && (
                  <span style={{ fontSize: 13, color: "#c9bda8", display: "flex", alignItems: "center", gap: 5, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {session.user.email}
                  </span>
                )}
                <button onClick={() => { setMsgView("list"); setActiveConv(null); setDetail(null); setPosting(false); setAuthView(null); setEditing(null); }}
                  className="pz-btn" aria-label="Съобщения"
                  style={{ position: "relative", background: msgView ? "#E8A33D" : "transparent", color: msgView ? "#16130F" : "#F4EBDD", border: "1.5px solid", borderColor: msgView ? "#E8A33D" : "#4a4339", borderRadius: 11, padding: "9px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 14, minHeight: 44 }}>
                  <MessageCircle size={16} /> {!isMobile && "Съобщения"}
                  {unread > 0 && (
                    <span style={{ position: "absolute", top: -6, right: -6, minWidth: 20, height: 20, padding: "0 5px", background: "#cc3333", color: "#fff", borderRadius: 999, fontSize: 12, fontWeight: 800, display: "grid", placeItems: "center", border: "2px solid #16130F" }}>
                      {unread}
                    </span>
                  )}
                </button>
                <button onClick={logout} className="pz-btn" aria-label="Изход"
                  style={{ background: "transparent", color: "#F4EBDD", border: "1.5px solid #4a4339", borderRadius: 11, padding: "9px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 14, minHeight: 44 }}>
                  <LogOut size={16} /> {!isMobile && "Изход"}
                </button>
              </>
            ) : (
              <button onClick={() => { setAuthView("login"); setDetail(null); setPosting(false); }}
                className="pz-btn"
                style={{ background: "transparent", color: "#F4EBDD", border: "1.5px solid #4a4339", borderRadius: 11, padding: "9px 14px", cursor: "pointer", fontWeight: 700, fontSize: 14, minHeight: 44 }}>
                Вход
              </button>
            )}
            <button onClick={goPost} className="pz-btn" aria-label="Добави обява"
              style={{ background: "#E8A33D", color: "#16130F", border: "none", borderRadius: 11, padding: isMobile ? "9px 13px" : "10px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontWeight: 800, fontSize: 14, whiteSpace: "nowrap", minHeight: 44 }}>
              <Plus size={18} /> {!isMobile && "Добави обява"}
            </button>
          </div>
          {isMobile && (
            <div style={{ flexBasis: "100%", position: "relative" }}>
              <Search size={18} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#9c8f7d" }} />
              <input value={q} onChange={(e) => { setQ(e.target.value); setDetail(null); setPosting(false); setAuthView(null); }}
                placeholder="Какво търсиш?"
                style={{ width: "100%", padding: "12px 14px 12px 40px", borderRadius: 11, border: "none", fontSize: 16, background: "#F4EBDD", color: "#16130F" }} />
            </div>
          )}
        </div>
      </header>

      {/* CATEGORY STRIP */}
      {!detail && !posting && !authView && !editing && !msgView && (
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
        {msgView === "chat" && activeConv ? (
          <ChatView conversation={activeConv} userId={session?.user?.id} onBack={() => { setActiveConv(null); setMsgView("list"); }} onRead={refreshUnread} />
        ) : msgView === "list" ? (
          <ConversationList userId={session?.user?.id} onBack={() => setMsgView(null)} onOpen={(c) => { setActiveConv(c); setMsgView("chat"); }} />
        ) : authView ? (
          <Auth view={authView} setView={setAuthView} onDone={() => setAuthView(null)} />
        ) : editing ? (
          <PostForm
            mode="edit"
            existing={editing}
            onSubmit={(form, urls) => updateListing(editing.id, form, urls)}
            onCancel={() => { setEditing(null); setDetail(editing); }}
            defaultName={editing.seller_name}
            defaultEmail={editing.email || ""}
            userId={session?.user?.id}
          />
        ) : posting ? (
          <PostForm onSubmit={addListing} onCancel={() => setPosting(false)} defaultName={session?.user?.email?.split("@")[0] || ""} defaultEmail={session?.user?.email || ""} userId={session?.user?.id} />
        ) : detail ? (
          <Detail item={detail} onBack={() => setDetail(null)} isFav={favs.includes(detail.id)} onFav={() => toggleFav(detail.id)} onRemove={removeListing} onEdit={() => { setEditing(detail); setDetail(null); }} onToggleSold={toggleSold} onContact={contactSeller} isMobile={isMobile} isOwner={session?.user?.id === detail.user_id} />
        ) : (
          <>
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
                {city !== "Цяла България" && <option value="near">По близост</option>}
              </select>
            </div>

            {showFilters && (
              <div style={{ background: "#fff", border: "1px solid #e6dcc9", borderRadius: 14, padding: 18, marginBottom: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
                <Field label="Град">
                  <select value={city} onChange={(e) => { setCity(e.target.value); if (e.target.value === "Цяла България") setRadius(0); }} style={inp}>
                    {CITIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Разстояние">
                  <select value={radius} onChange={(e) => setRadius(+e.target.value)} disabled={city === "Цяла България"}
                    style={{ ...inp, opacity: city === "Цяла България" ? 0.5 : 1, cursor: city === "Цяла България" ? "not-allowed" : "pointer" }}>
                    {RADIUS_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                  </select>
                </Field>
                <Field label="Цена от">
                  <input type="number" value={minP} onChange={(e) => setMinP(e.target.value)} placeholder="0" style={inp} />
                </Field>
                <Field label="Цена до">
                  <input type="number" value={maxP} onChange={(e) => setMaxP(e.target.value)} placeholder="—" style={inp} />
                </Field>
                <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", alignSelf: "flex-end", padding: "11px 0" }}>
                  <input type="checkbox" checked={hideSold} onChange={(e) => setHideSold(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#C9762B", cursor: "pointer" }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#5c5345" }}>Скрий продадените</span>
                </label>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button onClick={() => { setCity("Цяла България"); setRadius(0); setMinP(""); setMaxP(""); setCat("all"); setShowFavsOnly(false); setHideSold(false); }}
                    style={{ padding: "11px 14px", borderRadius: 10, border: "1.5px solid #C9762B", background: "#fff", color: "#C9762B", fontWeight: 700, cursor: "pointer", width: "100%" }}>
                    Изчисти филтрите
                  </button>
                </div>
              </div>
            )}

            {loadingList ? (
              <div style={{ textAlign: "center", padding: "70px 20px", color: "#5c5345", fontWeight: 600 }}>Зареждане на обявите…</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "70px 20px", color: "#5c5345" }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>🔍</div>
                <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 6 }}>Няма намерени обяви</div>
                <p style={{ margin: "0 0 18px" }}>Опитай с друга категория или махни част от филтрите.</p>
                <button onClick={goPost} style={{ background: "#E8A33D", color: "#16130F", border: "none", borderRadius: 10, padding: "11px 18px", fontWeight: 800, cursor: "pointer" }}>
                  Добави обява
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(248px, 1fr))", gap: isMobile ? 10 : 16 }}>
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

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: "#5c5345" }}>{label}</span>
      {children}
    </label>
  );
}

function Err({ children }) {
  return <span style={{ color: "#a04030", fontSize: 13, fontWeight: 600, marginTop: 5, display: "block" }}>{children}</span>;
}

/* ---------------- AUTH ---------------- */
function Auth({ view, setView, onDone }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const isSignup = view === "signup";

  const submit = async () => {
    setErr(null); setMsg(null);
    if (!email.trim() || !pass) { setErr("Попълни имейл и парола."); return; }
    if (pass.length < 6) { setErr("Паролата трябва да е поне 6 знака."); return; }
    setBusy(true);
    if (isSignup) {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: pass });
      setBusy(false);
      if (error) { setErr(translateAuthError(error.message)); return; }
      if (data.session) { onDone(); }
      else { setMsg("Изпратихме ти имейл за потвърждение. Провери пощата си и потвърди регистрацията, после влез."); }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
      setBusy(false);
      if (error) { setErr(translateAuthError(error.message)); return; }
      onDone();
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: "40px auto 0" }}>
      <div style={{ background: "#fff", borderRadius: 18, padding: 28, border: "1px solid #e6dcc9" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", textAlign: "center" }}>
          {isSignup ? "Регистрация" : "Вход"}
        </h1>
        <p style={{ textAlign: "center", color: "#5c5345", margin: "0 0 22px", fontSize: 15 }}>
          {isSignup ? "Вече имаш профил?" : "Нямаш профил още?"}{" "}
          <button onClick={() => { setView(isSignup ? "login" : "signup"); setErr(null); setMsg(null); }}
            style={{ background: "none", border: "none", color: "#C9762B", fontWeight: 800, cursor: "pointer", fontSize: 15, padding: 0 }}>
            {isSignup ? "Влез" : "Регистрирай се"}
          </button>
        </p>

        <div style={{ display: "grid", gap: 14 }}>
          <Field label="Имейл">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ivan@example.bg" style={inp} autoComplete="email" />
          </Field>
          <Field label="Парола">
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="поне 6 знака" style={inp} autoComplete={isSignup ? "new-password" : "current-password"}
              onKeyDown={(e) => e.key === "Enter" && submit()} />
          </Field>

          {err && <div style={{ background: "#fbeae5", color: "#a04030", padding: "10px 12px", borderRadius: 10, fontSize: 14, fontWeight: 600 }}>{err}</div>}
          {msg && <div style={{ background: "#e7f0e9", color: "#2f5938", padding: "10px 12px", borderRadius: 10, fontSize: 14, fontWeight: 600 }}>{msg}</div>}

          <button onClick={submit} disabled={busy} className="pz-btn"
            style={{ background: "#E8A33D", color: "#16130F", border: "none", borderRadius: 12, padding: "14px", fontWeight: 800, fontSize: 16, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}>
            {busy ? "Момент…" : isSignup ? "Създай профил" : "Влез"}
          </button>
        </div>
      </div>
    </div>
  );
}

function translateAuthError(m) {
  if (/invalid login/i.test(m)) return "Грешен имейл или парола.";
  if (/already registered|already exists/i.test(m)) return "Вече има профил с този имейл. Влез вместо това.";
  if (/email/i.test(m) && /valid/i.test(m)) return "Невалиден имейл адрес.";
  if (/password/i.test(m)) return "Проблем с паролата — пробвай по-дълга.";
  return "Нещо се обърка. Опитай пак.";
}

/* ---------------- CARD ---------------- */
function Card({ item, fav, onFav, onOpen }) {
  const cover = item.photos && item.photos.length > 0 ? item.photos[0] : null;
  const bg = item.photo || "#C9762B";
  const catObj = CATEGORIES.find((c) => c.id === item.cat);
  return (
    <article className="pz-card" onClick={onOpen}
      style={{ background: "#fff", borderRadius: 16, overflow: "hidden", cursor: "pointer", border: "1px solid #e6dcc9" }}>
      <div style={{ aspectRatio: "4 / 3", width: "100%", background: cover ? "#eee" : bg, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {cover ? (
          <img src={cover} alt={item.title} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block", filter: item.sold ? "grayscale(0.7) brightness(0.85)" : "none" }} />
        ) : (
          <span style={{ fontSize: 46, opacity: item.sold ? 0.5 : 0.9 }}>{catObj?.icon}</span>
        )}
        {item.sold && (
          <span style={{ position: "absolute", top: 10, left: 10, background: "#a04030", color: "#fff", fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 999 }}>
            ПРОДАДЕНО
          </span>
        )}
        {item.photos && item.photos.length > 1 && (
          <span style={{ position: "absolute", bottom: 10, left: 10, background: "rgba(22,19,15,.78)", color: "#F4EBDD", fontSize: 12, fontWeight: 700, padding: "3px 8px", borderRadius: 999 }}>
            📷 {item.photos.length}
          </span>
        )}
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
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Clock size={13} /> {fmtTime(item.created_at)}</span>
        </div>
      </div>
    </article>
  );
}

/* ---------------- DETAIL ---------------- */
function Detail({ item, onBack, isFav, onFav, onRemove, onEdit, onToggleSold, onContact, isMobile, isOwner }) {
  const bg = item.photo || "#C9762B";
  const catObj = CATEGORIES.find((c) => c.id === item.cat);
  const photos = item.photos || [];
  const [active, setActive] = useState(0);
  const hasPhotos = photos.length > 0;
  return (
    <div style={{ padding: "20px 0 0" }}>
      <button onClick={onBack} className="pz-btn"
        style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "#5c5345", cursor: "pointer", fontWeight: 700, fontSize: 15, marginBottom: 16, padding: "6px 0", minHeight: 44 }}>
        <ChevronLeft size={19} /> Назад към обявите
      </button>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1.5fr) minmax(0,1fr)", gap: 24, alignItems: "start" }}>
        <div>
          {hasPhotos ? (
            <div>
              <div style={{ height: isMobile ? 280 : 420, background: "#eee", borderRadius: 18, overflow: "hidden", position: "relative" }}>
                <img src={photos[active]} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover", filter: item.sold ? "grayscale(0.7) brightness(0.85)" : "none" }} />
                <span style={{ position: "absolute", top: 14, left: 14, background: "rgba(244,235,221,.95)", padding: "5px 12px", borderRadius: 999, fontWeight: 700, fontSize: 13 }}>{catObj?.label}</span>
                {item.sold && <span style={{ position: "absolute", top: 14, right: 14, background: "#a04030", color: "#fff", padding: "6px 14px", borderRadius: 999, fontWeight: 800, fontSize: 14 }}>ПРОДАДЕНО</span>}
              </div>
              {photos.length > 1 && (
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {photos.map((p, i) => (
                    <button key={i} onClick={() => setActive(i)} aria-label={`Снимка ${i + 1}`}
                      style={{ width: 72, height: 72, borderRadius: 10, overflow: "hidden", border: i === active ? "3px solid #C9762B" : "2px solid #e6dcc9", padding: 0, cursor: "pointer", background: "#eee" }}>
                      <img src={p} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ height: isMobile ? 240 : 360, background: bg, borderRadius: 18, display: "grid", placeItems: "center", position: "relative", filter: item.sold ? "grayscale(0.7) brightness(0.85)" : "none" }}>
              <span style={{ fontSize: isMobile ? 72 : 96, opacity: 0.92 }}>{catObj?.icon}</span>
              <span style={{ position: "absolute", top: 14, left: 14, background: "rgba(244,235,221,.95)", padding: "5px 12px", borderRadius: 999, fontWeight: 700, fontSize: 13 }}>{catObj?.label}</span>
              {item.sold && <span style={{ position: "absolute", top: 14, right: 14, background: "#a04030", color: "#fff", padding: "6px 14px", borderRadius: 999, fontWeight: 800, fontSize: 14 }}>ПРОДАДЕНО</span>}
            </div>
          )}
          <div style={{ background: "#fff", borderRadius: 16, padding: 22, marginTop: 16, border: "1px solid #e6dcc9" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 800 }}>Описание</h3>
            <p style={{ margin: 0, lineHeight: 1.65, color: "#3a342b", whiteSpace: "pre-wrap" }}>{item.descr}</p>
          </div>
        </div>
        <aside style={{ position: isMobile ? "static" : "sticky", top: 130 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 22, border: "1px solid #e6dcc9" }}>
            <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800, lineHeight: 1.2, letterSpacing: "-0.02em" }}>{item.title}</h1>
            <div style={{ fontSize: 30, fontWeight: 900, color: "#C9762B", letterSpacing: "-0.02em" }}>{fmtPrice(item.price)}</div>
            <div style={{ display: "flex", gap: 14, margin: "14px 0", flexWrap: "wrap", fontSize: 14, color: "#5c5345" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={15} /> {item.city}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Tag size={15} /> {item.cond}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={15} /> {fmtTime(item.created_at)}</span>
            </div>
            <div style={{ borderTop: "1px solid #eee3d2", paddingTop: 16, marginTop: 4 }}>
              <div style={{ fontSize: 13, color: "#9c8f7d", fontWeight: 700 }}>Продавач</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{item.seller_name}</div>
              {!isOwner && (
                <button onClick={() => onContact(item)} className="pz-btn"
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#E8A33D", color: "#16130F", border: "none", borderRadius: 11, padding: "13px", fontWeight: 800, fontSize: 15, marginBottom: 9, cursor: "pointer" }}>
                  <MessageCircle size={18} /> Съобщение до продавача
                </button>
              )}
              <a href={`tel:${item.phone}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#16130F", color: "#F4EBDD", textDecoration: "none", borderRadius: 11, padding: "13px", fontWeight: 800, fontSize: 15, marginBottom: 9 }}>
                <Phone size={18} /> {item.phone}
              </a>
              {item.email && (
                <a href={`mailto:${item.email}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#fff", color: "#16130F", textDecoration: "none", border: "1.5px solid #16130F", borderRadius: 11, padding: "12px", fontWeight: 800, fontSize: 15 }}>
                  <Mail size={18} /> Изпрати имейл
                </a>
              )}
            </div>
            <button onClick={onFav} className="pz-btn"
              style={{ width: "100%", marginTop: 9, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: isFav ? "#F4EBDD" : "#fff", border: "1.5px solid #C9762B", color: "#C9762B", borderRadius: 11, padding: "12px", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
              <Heart size={18} fill={isFav ? "#C9762B" : "none"} /> {isFav ? "В любими" : "Запази"}
            </button>
            {isOwner && (
              <>
                <button onClick={() => onToggleSold(item.id, !item.sold)} className="pz-btn"
                  style={{ width: "100%", marginTop: 9, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: item.sold ? "#3C6E47" : "#fff", color: item.sold ? "#fff" : "#3C6E47", border: "1.5px solid #3C6E47", borderRadius: 11, padding: "12px", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
                  <Check size={17} /> {item.sold ? "Върни като активна" : "Маркирай като продадено"}
                </button>
                <button onClick={onEdit} className="pz-btn"
                  style={{ width: "100%", marginTop: 9, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#16130F", color: "#F4EBDD", border: "none", borderRadius: 11, padding: "12px", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
                  <Pencil size={17} /> Редактирай обявата
                </button>
                <button onClick={() => onRemove(item.id)}
                  style={{ width: "100%", marginTop: 9, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, background: "none", border: "none", color: "#a04030", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                  <Trash2 size={16} /> Изтрий обявата
                </button>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ---------------- POST FORM ---------------- */
function PostForm({ onSubmit, onCancel, defaultName, defaultEmail, userId, mode, existing }) {
  const isEdit = mode === "edit";
  const [f, setF] = useState(
    isEdit
      ? { title: existing.title, cat: existing.cat, price: existing.price === 0 ? "" : String(existing.price), city: existing.city, cond: existing.cond, descr: existing.descr, seller_name: existing.seller_name, phone: existing.phone, email: existing.email || "", photo: existing.photo || "#E8A33D" }
      : { title: "", cat: "tehnika", price: "", city: "София", cond: "Употребявано", descr: "", seller_name: defaultName, phone: "", email: defaultEmail, photo: "#E8A33D" }
  );
  const [existingUrls, setExistingUrls] = useState(isEdit && existing.photos ? existing.photos : []);
  const [photos, setPhotos] = useState([]); // нови: { file, preview }
  const [err, setErr] = useState({});
  const [serverErr, setServerErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const MAX_PHOTOS = 8;
  const totalPhotos = existingUrls.length + photos.length;

  const removeExisting = (i) => setExistingUrls((prev) => prev.filter((_, idx) => idx !== i));

  const onPick = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // allow re-picking same file
    const room = MAX_PHOTOS - totalPhotos;
    const toAdd = files.slice(0, room).map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setPhotos((prev) => [...prev, ...toAdd]);
  };
  const removePhoto = (i) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const uploadAll = async () => {
    const urls = [];
    for (let i = 0; i < photos.length; i++) {
      setProgress(`Качване на снимка ${i + 1} от ${photos.length}…`);
      const { file } = photos[i];
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/${Date.now()}-${i}.${ext}`;
      const { error } = await supabase.storage.from("listing-photos").upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("listing-photos").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  };

  const submit = async () => {
    const e = {};
    if (!f.title.trim()) e.title = "Въведи заглавие";
    if (!f.descr.trim()) e.descr = "Добави описание";
    if (!f.seller_name.trim()) e.seller_name = "Въведи име";
    if (!f.phone.trim()) e.phone = "Въведи телефон";
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true); setServerErr(null);
    try {
      let newUrls = [];
      if (photos.length > 0) newUrls = await uploadAll();
      setProgress("Запазване…");
      const allUrls = [...existingUrls, ...newUrls];
      const res = await onSubmit(f, allUrls);
      if (res?.error) setServerErr(res.error);
    } catch (ex) {
      setServerErr("Проблем при качване на снимките. Опитай пак.");
    }
    setBusy(false); setProgress("");
  };

  return (
    <div style={{ padding: "24px 0 0", maxWidth: 720, margin: "0 auto" }}>
      <button onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "#5c5345", cursor: "pointer", fontWeight: 700, fontSize: 15, marginBottom: 16, padding: 0 }}>
        <ChevronLeft size={19} /> Отказ
      </button>
      <h1 style={{ fontSize: 30, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.03em" }}>{isEdit ? "Редактиране на обява" : "Нова обява"}</h1>
      <p style={{ color: "#5c5345", marginTop: 0, marginBottom: 22 }}>{isEdit ? "Промени каквото е нужно и запази." : "Попълни полетата. Обявата се публикува веднага и безплатно."}</p>

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

        <Field label={`Снимки (до ${MAX_PHOTOS}) — първата е корица`}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {existingUrls.map((url, i) => (
              <div key={`ex-${i}`} style={{ position: "relative", width: 84, height: 84 }}>
                <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10, border: i === 0 ? "3px solid #C9762B" : "2px solid #e6dcc9" }} />
                {i === 0 && <span style={{ position: "absolute", bottom: 3, left: 3, background: "rgba(201,118,43,.95)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 5 }}>корица</span>}
                <button onClick={() => removeExisting(i)} aria-label="Премахни"
                  style={{ position: "absolute", top: -7, right: -7, width: 24, height: 24, borderRadius: 999, background: "#16130F", color: "#fff", border: "2px solid #fff", display: "grid", placeItems: "center", cursor: "pointer", padding: 0 }}>
                  <X size={13} />
                </button>
              </div>
            ))}
            {photos.map((p, i) => {
              const isFirst = existingUrls.length === 0 && i === 0;
              return (
                <div key={`new-${i}`} style={{ position: "relative", width: 84, height: 84 }}>
                  <img src={p.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10, border: isFirst ? "3px solid #C9762B" : "2px solid #e6dcc9" }} />
                  {isFirst && <span style={{ position: "absolute", bottom: 3, left: 3, background: "rgba(201,118,43,.95)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 5 }}>корица</span>}
                  <button onClick={() => removePhoto(i)} aria-label="Премахни"
                    style={{ position: "absolute", top: -7, right: -7, width: 24, height: 24, borderRadius: 999, background: "#16130F", color: "#fff", border: "2px solid #fff", display: "grid", placeItems: "center", cursor: "pointer", padding: 0 }}>
                    <X size={13} />
                  </button>
                </div>
              );
            })}
            {totalPhotos < MAX_PHOTOS && (
              <label style={{ width: 84, height: 84, borderRadius: 10, border: "2px dashed #c9bda8", display: "grid", placeItems: "center", cursor: "pointer", color: "#9c8f7d", background: "#F4EBDD" }}>
                <input type="file" accept="image/*" multiple onChange={onPick} style={{ display: "none" }} />
                <span style={{ display: "grid", placeItems: "center", gap: 3, textAlign: "center" }}>
                  <ImagePlus size={22} />
                  <span style={{ fontSize: 11, fontWeight: 700 }}>Добави</span>
                </span>
              </label>
            )}
          </div>
          <span style={{ fontSize: 12.5, color: "#9c8f7d", marginTop: 8, display: "block" }}>
            Снимките не са задължителни, но обявите със снимки получават много повече интерес. До 5 MB на снимка.
          </span>
        </Field>

        <Field label="Описание *">
          <textarea value={f.descr} onChange={(e) => set("descr", e.target.value)} rows={4} placeholder="Опиши какво продаваш — състояние, детайли, причина за продажба…" style={{ ...inp, resize: "vertical", borderColor: err.descr ? "#a04030" : "#e6dcc9" }} />
          {err.descr && <Err>{err.descr}</Err>}
        </Field>

        <div style={{ borderTop: "1px solid #eee3d2", paddingTop: 16, display: "grid", gap: 14 }}>
          <Field label="Твоето име *">
            <input value={f.seller_name} onChange={(e) => set("seller_name", e.target.value)} placeholder="Иван П." style={{ ...inp, borderColor: err.seller_name ? "#a04030" : "#e6dcc9" }} />
            {err.seller_name && <Err>{err.seller_name}</Err>}
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

        {serverErr && <div style={{ background: "#fbeae5", color: "#a04030", padding: "10px 12px", borderRadius: 10, fontSize: 14, fontWeight: 600 }}>{serverErr}</div>}

        <button onClick={submit} disabled={busy} className="pz-btn"
          style={{ background: "#E8A33D", color: "#16130F", border: "none", borderRadius: 12, padding: "15px", fontWeight: 800, fontSize: 16, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Check size={20} /> {busy ? (progress || "Запазване…") : isEdit ? "Запази промените" : "Публикувай обявата"}
        </button>
      </div>
    </div>
  );
}
