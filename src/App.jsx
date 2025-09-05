import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { createSocket } from "./socket";

function AuthView({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function submit(e) {
    e.preventDefault();
    try {
      if (mode === "register") await api.register(username, password);
      const { token, user } = await api.login(username, password);
      localStorage.setItem("token", token);
      onAuthed({ token, user });
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "80px auto" }}>
      <h2>Chat Login</h2>
      <form className="stack" onSubmit={submit}>
        <input className="input" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
        <input className="input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        <button className="btn primary" type="submit">{mode === "login" ? "Login" : "Register & Login"}</button>
        <div className="row">
          <span>Mode:</span>
          <button type="button" className="btn" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            Switch to {mode === "login" ? "Register" : "Login"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [me, setMe] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState("");
  const [currentRoomId, setCurrentRoomId] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typingMap, setTypingMap] = useState({});
  const [onlineMap, setOnlineMap] = useState({});
  const socketRef = useRef(null);
  const prevTypingRef = useRef(false);

  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentRoomId]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const user = await api.me(token);
        setMe(user);
        setRooms(await api.rooms());

        const s = createSocket(token);
        socketRef.current = s;

        s.on("connect", () => console.log("socket connected", s.id));
        s.on("disconnect", () => console.log("socket disconnected"));
      } catch (e) {
        alert(e.message);
        localStorage.removeItem("token");
        setToken("");
      }
    })();

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;

    const onMsg = (msg) => {
      if (msg.room === currentRoomId) setMessages(prev => [...prev, msg]);
    };
    const onTyping = ({ roomId, userId, username, isTyping }) => {
      if (roomId !== currentRoomId) return;
      setTypingMap(m => ({ ...m, [userId]: !!isTyping }));
      if (username) setOnlineMap(om => ({ ...om, [userId]: username }));
    };
    const onPresence = ({ roomId, users }) => {
      if (roomId !== currentRoomId) return;
      const m = {};
      (users || []).forEach(u => { m[u.userId] = u.username; });
      setOnlineMap(m);
    };
    const onUserOnline = ({ roomId, userId, username }) => {
      if (currentRoomId && roomId && roomId !== currentRoomId) return;
      setOnlineMap(om => ({ ...om, [userId]: username || om[userId] || "user" }));
    };
    const onUserOffline = ({ roomId, userId }) => {
      if (currentRoomId && roomId && roomId !== currentRoomId) return;
      setOnlineMap(om => { const c = { ...om }; delete c[userId]; return c; });
      setTypingMap(m => { const c = { ...m }; delete c[userId]; return c; });
    };

    s.on("chatMessage", onMsg);
    s.on("typing", onTyping);
    s.on("presence", onPresence);
    s.on("userOnline", onUserOnline);
    s.on("userOffline", onUserOffline);

    return () => {
      s.off("chatMessage", onMsg);
      s.off("typing", onTyping);
      s.off("presence", onPresence);
      s.off("userOnline", onUserOnline);
      s.off("userOffline", onUserOffline);
    };
  }, [currentRoomId]);

  const isObjectId = (s) => /^[a-f\d]{24}$/i.test(String(s || ""));

  async function selectRoom(roomId) {
    if (!roomId || !isObjectId(roomId)) {
      alert("Room ID tidak valid");
      return;
    }
    if (roomId === currentRoomId) return;

    // leave lama
    if (currentRoomId && socketRef.current) {
      socketRef.current.emit("leaveRoom", { roomId: currentRoomId });
    }

    setCurrentRoomId(roomId);
    setMessages([]);
    setTypingMap({});
    setOnlineMap({});
    prevTypingRef.current = false;

    try {
      await api.joinRoom(roomId, token);

      socketRef.current?.emit("joinRoom", { roomId });
      const ms = await api.getMessages(roomId, token);
      setMessages(ms.slice().reverse());
    } catch (e) {
      console.error(e);
      alert(e.message);
    }
  }

  function leaveCurrentRoom() {
    if (!currentRoomId || !socketRef.current) return;
    socketRef.current.emit("leaveRoom", { roomId: currentRoomId });
    setTypingMap({});
    setOnlineMap({});
    setMessages([]);
    setCurrentRoomId("");
    prevTypingRef.current = false;
  }

  function onInputChange(e) {
    const v = e.target.value;
    setInput(v);
    const hasText = v.trim().length > 0;
    if (hasText !== prevTypingRef.current && socketRef.current && currentRoomId) {
      socketRef.current.emit("typing", { roomId: currentRoomId, isTyping: hasText });
      prevTypingRef.current = hasText;
    }
  }

  function sendViaSocket() {
    if (!input.trim() || !currentRoomId) return;
    socketRef.current?.emit("chatMessage", { roomId: currentRoomId, content: input.trim() });
    setInput("");
    if (prevTypingRef.current) {
      socketRef.current?.emit("typing", { roomId: currentRoomId, isTyping: false });
      prevTypingRef.current = false;
    }
  }

  async function sendViaHTTP() {
    if (!input.trim() || !currentRoomId) return;
    try {
      await api.sendMessageHTTP(currentRoomId, token, input.trim());
      setInput("");
      if (prevTypingRef.current) {
        socketRef.current?.emit("typing", { roomId: currentRoomId, isTyping: false });
        prevTypingRef.current = false;
      }
    } catch (e) {
      alert(e.message);
    }
  }

  const typingUsers = useMemo(
    () => Object.entries(typingMap).filter(([, v]) => v).map(([uid]) => onlineMap[uid] || `user-${uid.slice(-4)}`),
    [typingMap, onlineMap]
  );

  if (!token) return <AuthView onAuthed={({ token }) => setToken(token)} />;

  return (
    <div className="app">
      <aside className="sidebar">
        <h3>Hi, {me?.username}</h3>
        <div className="sep" />
        <div className="stack">
          <div className="row">
            <input className="input" placeholder="Nama room..." value={newRoomName} onChange={e => setNewRoomName(e.target.value)} />
            <button className="btn" onClick={async () => {
              try { const r = await api.createRoom(newRoomName, token); setRooms(prev => [...prev, r]); setNewRoomName(""); }
              catch (e) { alert(e.message); }
            }}>Create</button>
          </div>
          <strong>Rooms</strong>
          <div className="rooms">
            {rooms.map(r => (
              <div key={r._id} className={`room ${currentRoomId === r._id ? "active" : ""}`} onClick={() => selectRoom(r._id)}>
                <div>{r.name}</div>
                <div className="row" style={{ gap: 6, marginTop: 4 }}>
                  <span className="badge">{(r.members?.length ?? 0)} members</span>
                </div>
              </div>
            ))}
          </div>
          {currentRoomId && <button className="btn" onClick={leaveCurrentRoom}>Leave Current Room</button>}
        </div>
      </aside>

      <main className="main">
        <div className="header">
          {currentRoomId ? (
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>Room: <strong>{rooms.find(r => r._id === currentRoomId)?.name || currentRoomId}</strong></div>
              <div className="row" style={{ gap: 6 }}>
                <span className="badge green">Online: {Object.keys(onlineMap).length}</span>
                {typingUsers.length > 0 && (
                  <span className="badge yellow">{typingUsers.join(", ")} typing...</span>
                )}
              </div>
            </div>
          ) : <em>Pilih room untuk mulai chat</em>}
        </div>

        <div className="msglist">
          {currentRoomId ? (
            <>
              {messages.map((m) => {
                const isMine = m?.sender?._id && me?._id && String(m.sender._id) === String(me._id);
                return (
                  <div key={m._id} className={`msg-row ${isMine ? "mine" : "other"}`}>
                    <div className={`msg-bubble ${isMine ? "mine" : "other"}`}>
                      {!isMine && (
                        <div className="msg-name">{m.sender?.username || "user"}</div>
                      )}
                      <div className="msg-text">{m.content}</div>
                      <div className="msg-time">
                        {new Date(m.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </>
          ) : (
            <div style={{ color: "#6b7280" }}>Belum ada room yang dipilih.</div>
          )}
        </div>

        <div className="footer">
          <div className="row">
            <input
              className="input" style={{ flex: 1 }}
              placeholder="Tulis pesan di sini…"
              value={input}
              onChange={onInputChange}
              onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") sendViaSocket(); }}
              disabled={!currentRoomId}
            />
            <button className="btn" onClick={sendViaSocket} disabled={!currentRoomId}>Send (Socket)</button>
            <button className="btn" onClick={sendViaHTTP} disabled={!currentRoomId}>Send (HTTP)</button>
          </div>
        </div>
      </main>
    </div>
  );
}
