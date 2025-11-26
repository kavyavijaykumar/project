import React, { useEffect, useState } from "react";
import { Bar, Pie, Line } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale, LineElement, PointElement } from "chart.js";
import { api } from "../../api";

ChartJS.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale, LineElement, PointElement);

function Stats() {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const [statsRes, historyRes] = await Promise.all([
        api.get("/user/stats"),
        api.get("/history")
      ]);
      setStats(statsRes.data);
      setHistory(historyRes.data);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching user data:", err);
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading your statistics...</div>;
  }

  if (!stats) {
    return <div>Error loading statistics.</div>;
  }

  const labels = Object.keys(stats.label_count);
  const counts = Object.values(stats.label_count);

  // Chart data for label distribution
  const labelChartData = {
    labels,
    datasets: [
      {
        label: "Detections per Label",
        data: counts,
        backgroundColor: ["#00f5ff", "#8aff6c", "#ffdd57", "#ff8080", "#c084fc", "#fb923c"],
      },
    ],
  };

  // Chart data for detections over time
  const timeChartData = {
    labels: Object.keys(stats.detections_by_date).sort(),
    datasets: [
      {
        label: "Your Detections Over Time",
        data: Object.keys(stats.detections_by_date).sort().map(date => stats.detections_by_date[date]),
        borderColor: "#00f5ff",
        backgroundColor: "rgba(0, 245, 255, 0.1)",
        tension: 0.4,
      },
    ],
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Your Detection Statistics</h2>

      {/* Summary Card */}
      <div style={{ 
        background: "var(--card-bg)", 
        padding: "20px", 
        borderRadius: "10px", 
        marginTop: "20px",
        textAlign: "center"
      }}>
        <h3 style={{ color: "#00f5ff", margin: "0 0 10px 0", fontSize: "3em" }}>
          {stats.total_detections}
        </h3>
        <p style={{ margin: 0, fontSize: "1.2em" }}>Total Detections</p>
        <p style={{ margin: "10px 0 0 0", color: "#888" }}>Account: {stats.email}</p>
      </div>

      {labels.length > 0 ? (
        <>
          {/* Charts Section */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", marginTop: "40px" }}>
            <div style={{ background: "var(--card-bg)", padding: "20px", borderRadius: "10px" }}>
              <h4>Detection Distribution</h4>
              <Pie data={labelChartData} />
            </div>
            <div style={{ background: "var(--card-bg)", padding: "20px", borderRadius: "10px" }}>
              <h4>Detections by Type</h4>
              <Bar data={labelChartData} />
            </div>
          </div>

          {/* Timeline Chart */}
          <div style={{ background: "var(--card-bg)", padding: "20px", borderRadius: "10px", marginTop: "40px" }}>
            <h4>Detection Timeline</h4>
            <Line data={timeChartData} />
          </div>

          {/* Label Breakdown */}
          <div style={{ background: "var(--card-bg)", padding: "20px", borderRadius: "10px", marginTop: "40px" }}>
            <h4>Detection Breakdown</h4>
            <table style={{ width: "100%", marginTop: "20px", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #333" }}>
                  <th style={{ padding: "10px", textAlign: "left" }}>Label</th>
                  <th style={{ padding: "10px", textAlign: "left" }}>Count</th>
                  <th style={{ padding: "10px", textAlign: "left" }}>Percentage</th>
                </tr>
              </thead>
              <tbody>
                {labels.map((label, idx) => {
                  const count = counts[idx];
                  const percentage = ((count / stats.total_detections) * 100).toFixed(1);
                  return (
                    <tr key={idx} style={{ borderBottom: "1px solid #222" }}>
                      <td style={{ padding: "10px" }}>{label}</td>
                      <td style={{ padding: "10px" }}>{count}</td>
                      <td style={{ padding: "10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{
                            width: "100px",
                            height: "8px",
                            background: "#333",
                            borderRadius: "4px",
                            overflow: "hidden"
                          }}>
                            <div style={{
                              width: `${percentage}%`,
                              height: "100%",
                              background: "#00f5ff"
                            }}></div>
                          </div>
                          <span>{percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Recent Detections */}
          <div style={{ background: "var(--card-bg)", padding: "20px", borderRadius: "10px", marginTop: "40px" }}>
            <h4>Recent Detections</h4>
            {history.slice(0, 5).map((item, idx) => (
              <div key={idx} style={{
                background: "#1a1a1a",
                padding: "15px",
                borderRadius: "8px",
                marginTop: "15px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                  <span><strong>Detected:</strong> {item.labels.join(", ")}</span>
                  <span style={{ color: "#888" }}>{item.timestamp}</span>
                </div>
                {item.image && (
                  <img
                    src={`data:image/jpeg;base64,${item.image}`}
                    alt="Detection"
                    style={{ maxWidth: "100%", borderRadius: "5px" }}
                  />
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ 
          background: "var(--card-bg)", 
          padding: "40px", 
          borderRadius: "10px", 
          marginTop: "40px",
          textAlign: "center"
        }}>
          <p style={{ fontSize: "1.2em" }}>No detection data yet.</p>
          <p style={{ color: "#888" }}>Upload an image to get started!</p>
        </div>
      )}
    </div>
  );
}

export default Stats;