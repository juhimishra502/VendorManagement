import { useState } from "react";
import { getHealth } from "../lib/api.js";

export function Home() {
  const [status, setStatus] = useState("Ready");

  async function checkApi() {
    setStatus("Checking API...");
    try {
      const response = await getHealth();
      setStatus(`API ${response.status}`);
    } catch {
      setStatus("API unavailable");
    }
  }

  return (
    <main className="shell">
      <section className="card">
        <p className="eyebrow">Vendrax</p>
        <h1>Start with a clear view of your vendors.</h1>
        <p className="summary">The application scaffold is ready for vendor, contract, document, and compliance features.</p>
        <button type="button" onClick={checkApi}>Check API</button>
        <p role="status">{status}</p>
      </section>
    </main>
  );
}
