import React, { useEffect, useState } from "react";
import { Bar, Pie, Line } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale, LineElement, PointElement } from "chart.js";
import { api } from "../../api";

ChartJS.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale, LineElement, PointElement);

function AdminPanel() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userHistory, setUserHistory] = useState([]);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const [statsRes, usersRes] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/users")
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching admin data:", err);
      setLoading(false);
    }
  };

  const handleUserClick = async (email) => {
    try {
      const res = await api.get(`/admin/user/${email}/history`);
      setUserHistory(res.data);
      setSelectedUser(email);
    } catch (err) {
      console.error("Error fetching user history:", err);
    }
  };

  if (loading) {
    return <div>Loading admin data...</div>;
  }

  if (!stats) {
    return <div>Error loading admin data.</div>;
  }

  // Prepare chart data for label distribution
  const labelChartData = {
    labels: Object.keys(stats.label_count),
    datasets: [
      {
        label: "Total Detections per Label",
        data: Object.values(stats.label_count),
        backgroundColor: ["#00f5ff", "#8aff6c", "#ffdd57", "#ff8080", "#c084fc", "#fb923c"],
      },
    ],
  };

  // Prepare chart data for user detections
  const userChartData = {
    labels: Object.keys(stats.user_detections),
    datasets: [
      {
        label: "Detections per User",
        data: Object.values(stats.user_detections),
        backgroundColor: "#00f5ff",
      },
    ],
  };

  // Prepare chart data for detections over time
  const timeChartData = {
    labels: Object.keys(stats.detections_by_date).sort(),
    datasets: [
      {
        label: "Detections Over Time",
        data: Object.keys(stats.detections_by_date).sort().map(date => stats.detections_by_date[date]),
        borderColor: "#00f5ff",
        backgroundColor: "rgba(0, 245, 255, 0.1)",
        tension: 0.4,
      },
    ],
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Admin Control Panel</h2>
      
      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginTop: "20px" }}>
        <div style={{ background: "var(--card-bg)", padding: "20px", borderRadius: "10px", textAlign: "center" }}>
          <h3 style={{ color: "#00f5ff", margin: "0 0 10px 0" }}>{stats.total_detections}</h3>
          <p style={{ margin: 0 }}>Total Detections</p>
        </div>
        <div style={{ background: "var(--card-bg)", padding: "20px", borderRadius: "10px", textAlign: "center" }}>
          <h3 style={{ color: "#8aff6c", margin: "0 0 10px 0" }}>{stats.unique_users}</h3>
          <p style={{ margin: 0 }}>Active Users</p>
        </div>
        <div style={{ background: "var(--card-bg)", padding: "20px", borderRadius: "10px", textAlign: "center" }}>
          <h3 style={{ color: "#ffdd57", margin: "0 0 10px 0" }}>{Object.keys(stats.label_count).length}</h3>
          <p style={{ margin: 0 }}>Unique Labels</p>
        </div>
      </div>

      {/* Charts Section */}
      <div style={{ marginTop: "40px" }}>
        <h3>Detection Statistics</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", marginTop: "20px" }}>
          <div style={{ background: "var(--card-bg)", padding: "20px", borderRadius: "10px" }}>
            <h4>Label Distribution</h4>
            <Pie data={labelChartData} />
          </div>
          <div style={{ background: "var(--card-bg)", padding: "20px", borderRadius: "10px" }}>
            <h4>User Activity</h4>
            <Bar data={userChartData} />
          </div>
        </div>

        <div style={{ background: "var(--card-bg)", padding: "20px", borderRadius: "10px", marginTop: "40px" }}>
          <h4>Detections Over Time</h4>
          <Line data={timeChartData} />
        </div>
      </div>

      {/* Users List */}
      <div style={{ marginTop: "40px" }}>
        <h3>Registered Users</h3>
        <div style={{ background: "var(--card-bg)", padding: "20px", borderRadius: "10px", marginTop: "20px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #333" }}>
                <th style={{ padding: "10px", textAlign: "left" }}>Username</th>
                <th style={{ padding: "10px", textAlign: "left" }}>Email</th>
                <th style={{ padding: "10px", textAlign: "left" }}>Role</th>
                <th style={{ padding: "10px", textAlign: "left" }}>Detections</th>
                <th style={{ padding: "10px", textAlign: "left" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #222" }}>
                  <td style={{ padding: "10px" }}>{user.username}</td>
                  <td style={{ padding: "10px" }}>{user.email}</td>
                  <td style={{ padding: "10px" }}>
                    <span style={{ 
                      background: user.role === "admin" ? "#ff8080" : "#00f5ff",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "0.8em"
                    }}>
                      {user.role || "user"}
                    </span>
                  </td>
                  <td style={{ padding: "10px" }}>{user.detection_count}</td>
                  <td style={{ padding: "10px" }}>
                    <button
                      onClick={() => handleUserClick(user.email)}
                      style={{
                        background: "#00f5ff",
                        border: "none",
                        padding: "6px 12px",
                        borderRadius: "5px",
                        cursor: "pointer",
                        color: "#000"
                      }}
                    >
                      View History
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected User History Modal */}
      {selectedUser && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "var(--card-bg)",
            padding: "30px",
            borderRadius: "10px",
            maxWidth: "800px",
            maxHeight: "80vh",
            overflow: "auto",
            width: "90%"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3>History for {selectedUser}</h3>
              <button
                onClick={() => setSelectedUser(null)}
                style={{
                  background: "#ff8080",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "5px",
                  cursor: "pointer"
                }}
              >
                Close
              </button>
            </div>
            {userHistory.length > 0 ? (
              <div style={{ display: "grid", gap: "20px" }}>
                {userHistory.map((item, idx) => (
                  <div key={idx} style={{ background: "#1a1a1a", padding: "15px", borderRadius: "8px" }}>
                    <p><strong>Timestamp:</strong> {item.timestamp}</p>
                    <p><strong>Labels:</strong> {item.labels.join(", ")}</p>
                    <p><strong>Filename:</strong> {item.filename || "N/A"}</p>
                    {item.image && (
                      <img 
                        src={`data:image/jpeg;base64,${item.image}`} 
                        alt="Detection" 
                        style={{ maxWidth: "100%", marginTop: "10px", borderRadius: "5px" }}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p>No history found for this user.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;