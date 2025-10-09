// src/components/SigilLogin.tsx
import { useState } from "react";
import { useSigilSession } from "../session/SigilSession";

export default function SigilLogin() {
  const { session, login, logout } = useSigilSession();
  const [val, setVal] = useState("");

  if (session) {
    return (
      <div className="sigil-login">
        <div className="ok">Logged in</div>
        <div>app: {session.appId.slice(0, 12)}…</div>
        <div>user: {session.userPhiKey.slice(0, 12)}…</div>
        <button onClick={logout}>Logout</button>
      </div>
    );
  }

  return (
    <div className="sigil-login">
      <label>Paste your user glyph URL</label>
      <input value={val} onChange={e=>setVal(e.target.value)} placeholder="https://kaiklok.com/s/... ?p=..." />
      <button onClick={() => login(val) || alert("Invalid glyph URL")}>Login</button>
    </div>
  );
}
