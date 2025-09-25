import React, { useState } from "react";

export default function Access() {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/preview/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });
    if (res.ok) window.location.href = "/";
    else setErr("Invalid code");
  }

  return (
    <main style={{maxWidth:420,margin:"10vh auto",padding:24,background:"rgba(255,255,255,.03)",borderRadius:12}}>
      <h2>Private Preview</h2>
      <p>Enter the preview code to access MashLab.</p>
      <form onSubmit={onSubmit}>
        <input
          value={code}
          onChange={(e)=>setCode(e.target.value)}
          placeholder="Preview code"
          style={{width:"100%",padding:12,margin:"12px 0"}}
        />
        <button type="submit">Enter</button>
      </form>
      {err && <div style={{color:"#ff6b6b",marginTop:8}}>{err}</div>}
    </main>
  );
}
