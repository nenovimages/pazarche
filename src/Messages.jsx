import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, Send, MessageCircle } from "lucide-react";
import { supabase } from "./supabase";

const fmtTime = (iso) => {
  const t = new Date(iso).getTime();
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return "сега";
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч`;
  const d = Math.floor(h / 24);
  return `${d} дни`;
};

/* Стартира (или намира) разговор за обява и връща conversation id */
export async function startConversation(listing, buyerId) {
  // вече съществуващ разговор?
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("listing_id", listing.id)
    .eq("buyer_id", buyerId)
    .maybeSingle();
  if (existing) return { id: existing.id };

  const { data, error } = await supabase
    .from("conversations")
    .insert({ listing_id: listing.id, buyer_id: buyerId, seller_id: listing.user_id })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: data.id };
}

/* Брой разговори с непрочетени съобщения за този потребител */
export async function getUnreadCount(userId) {
  const { data: convs, error } = await supabase
    .from("conversations")
    .select("id, buyer_id, seller_id, buyer_last_read, seller_last_read, last_message_at");
  if (error || !convs) return 0;
  let count = 0;
  for (const c of convs) {
    const lastRead = c.buyer_id === userId ? c.buyer_last_read : c.seller_last_read;
    // има ли по-ново съобщение от последното четене, и то не от мен?
    const { data: newer } = await supabase
      .from("messages")
      .select("id")
      .eq("conversation_id", c.id)
      .neq("sender_id", userId)
      .gt("created_at", lastRead || "1970-01-01")
      .limit(1);
    if (newer && newer.length > 0) count++;
  }
  return count;
}

/* Маркирай разговор като прочетен от този потребител */
async function markRead(conv, userId) {
  const field = conv.buyer_id === userId ? "buyer_last_read" : "seller_last_read";
  await supabase.from("conversations").update({ [field]: new Date().toISOString() }).eq("id", conv.id);
}

/* ---------- Списък с разговори ---------- */
export function ConversationList({ userId, onOpen, onBack }) {
  const [convs, setConvs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("conversations")
        .select("*, listings(title, photos, photo, cat, price)")
        .order("last_message_at", { ascending: false });
      if (!error && data) setConvs(data);
      setLoading(false);
    })();
  }, [userId]);

  return (
    <div style={{ padding: "20px 0 0", maxWidth: 760, margin: "0 auto" }}>
      <button onClick={onBack} className="pz-btn"
        style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "#5c5345", cursor: "pointer", fontWeight: 700, fontSize: 15, marginBottom: 16, padding: "6px 0", minHeight: 44 }}>
        <ChevronLeft size={19} /> Назад
      </button>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 18px", letterSpacing: "-0.02em" }}>Съобщения</h1>

      {loading ? (
        <div style={{ textAlign: "center", padding: "50px 20px", color: "#5c5345", fontWeight: 600 }}>Зареждане…</div>
      ) : convs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#5c5345" }}>
          <MessageCircle size={42} style={{ opacity: 0.4, marginBottom: 12 }} />
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Още няма съобщения</div>
          <p style={{ margin: 0 }}>Когато пишеш на продавач или някой ти пише, разговорите се появяват тук.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {convs.map((c) => {
            const l = c.listings || {};
            const cover = l.photos && l.photos.length > 0 ? l.photos[0] : null;
            const isSeller = c.seller_id === userId;
            return (
              <button key={c.id} onClick={() => onOpen(c)} className="pz-btn"
                style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", border: "1px solid #e6dcc9", borderRadius: 14, padding: 14, cursor: "pointer", textAlign: "left", width: "100%" }}>
                <div style={{ width: 60, height: 60, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: cover ? "#eee" : (l.photo || "#C9762B"), display: "grid", placeItems: "center" }}>
                  {cover ? <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 26 }}>📦</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15.5, color: "#16130F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title || "Обява"}</div>
                  <div style={{ fontSize: 13, color: "#9c8f7d", marginTop: 2 }}>
                    {isSeller ? "Купувач се интересува" : "Твоето запитване"} · преди {fmtTime(c.last_message_at)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Изглед на един разговор (чат) ---------- */
export function ChatView({ conversation, listing, userId, onBack, onRead }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const convId = conversation.id;

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    if (!error && data) setMessages(data);
    setLoading(false);
    // маркирай като прочетен (нужни са buyer_id/seller_id)
    const { data: full } = await supabase
      .from("conversations")
      .select("id, buyer_id, seller_id")
      .eq("id", convId)
      .single();
    if (full) {
      await markRead(full, userId);
      onRead && onRead();
    }
  }, [convId, userId, onRead]);

  useEffect(() => { load(); }, [load]);

  // лек "polling" — презарежда на всеки 5 сек, за да виждаш нови отговори
  useEffect(() => {
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: convId, sender_id: userId, body })
      .select()
      .single();
    if (!error && data) {
      setMessages((prev) => [...prev, data]);
      setText("");
      await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convId);
    }
    setSending(false);
  };

  const title = listing?.title || conversation.listings?.title || "Обява";

  return (
    <div style={{ padding: "20px 0 0", maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", minHeight: "70vh" }}>
      <button onClick={onBack} className="pz-btn"
        style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "#5c5345", cursor: "pointer", fontWeight: 700, fontSize: 15, marginBottom: 12, padding: "6px 0", minHeight: 44 }}>
        <ChevronLeft size={19} /> Всички съобщения
      </button>

      <div style={{ background: "#fff", border: "1px solid #e6dcc9", borderRadius: "14px 14px 0 0", padding: "14px 18px", fontWeight: 800, fontSize: 16 }}>
        {title}
      </div>

      <div style={{ flex: 1, background: "#fff", borderLeft: "1px solid #e6dcc9", borderRight: "1px solid #e6dcc9", padding: 18, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", minHeight: 300 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "#9c8f7d", margin: "auto", fontWeight: 600 }}>Зареждане…</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: "center", color: "#9c8f7d", margin: "auto", maxWidth: 320 }}>
            Напиши първото съобщение до продавача. Бъди учтив и попитай каквото те интересува за обявата.
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === userId;
            return (
              <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "75%", background: mine ? "#E8A33D" : "#F4EBDD", color: "#16130F", padding: "10px 14px", borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px", fontSize: 15, lineHeight: 1.45 }}>
                  <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.body}</div>
                  <div style={{ fontSize: 11, color: "#8a7d68", marginTop: 4, textAlign: "right" }}>преди {fmtTime(m.created_at)}</div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div style={{ background: "#fff", border: "1px solid #e6dcc9", borderRadius: "0 0 14px 14px", padding: 12, display: "flex", gap: 10 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Напиши съобщение…"
          style={{ flex: 1, padding: "12px 14px", borderRadius: 11, border: "1.5px solid #e6dcc9", fontSize: 15, background: "#F4EBDD", color: "#16130F" }}
        />
        <button onClick={send} disabled={sending || !text.trim()} className="pz-btn" aria-label="Изпрати"
          style={{ background: "#16130F", color: "#F4EBDD", border: "none", borderRadius: 11, padding: "0 18px", cursor: sending || !text.trim() ? "default" : "pointer", opacity: sending || !text.trim() ? 0.5 : 1, display: "grid", placeItems: "center" }}>
          <Send size={19} />
        </button>
      </div>
    </div>
  );
}
