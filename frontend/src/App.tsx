import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [status, setStatus] = useState("Connecting...");

  useEffect(() => {
    fetch("http://localhost:8001/api/v1/health")
      .then((response) => response.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus("Disconnected"));
  }, []);

  return (
    <main>
      <h1>SENTINEL</h1>
      <p>AI Agent Security Infrastructure</p>

      <section>
        <h2>System Status</h2>
        <p>Backend: {status}</p>
      </section>
    </main>
  );
}

export default App;
