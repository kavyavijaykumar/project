import React, { useEffect, useState } from "react";
import { api } from "../../api";

function History() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api.get("/history");
        setHistory(res.data);
      } catch (error) {
        console.error("Error fetching history:", error);
        setHistory([]);
      }
    };

    fetchHistory();
  }, []);

  const clearHistory = async () => {
    await api.delete("/clear_history");
    setHistory([]);
  };

  return (
    <div>
      <h2>Detection History</h2>
      <button onClick={clearHistory}>Clear History</button>
      <div style={{ marginTop: "20px" }}>
        {history.length === 0 && <p>No detection history available.</p>}
        {history.map((item, idx) => (
          <div
            key={idx}
            style={{
              border: "1px solid var(--border-color)",
              padding: "15px",
              borderRadius: "10px",
              marginBottom: "20px",
              background: "var(--card-bg)",
            }}
          >
            <p>
              <strong>Time:</strong> {item.timestamp}
            </p>
            <p>
              <strong>Detected:</strong> {item.labels.join(", ")}
            </p>
            <img
              src={`data:image/jpeg;base64,${item.image}`}
              alt="History item"
              width="400"
              style={{ borderRadius: "10px", marginTop: "10px" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default History;
