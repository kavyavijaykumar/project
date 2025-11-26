import React from "react";
import { Routes, Route } from "react-router-dom";
import Login from "./components/Auth/Login";
import Signup from "./components/Auth/Signup";
import Sidebar from "./components/Dashboard/Sidebar";
import Navbar from "./components/Dashboard/Navbar";
import Upload from "./components/Dashboard/Upload";
import LiveCamera from "./components/Dashboard/LiveCamera";
import History from "./components/Dashboard/History";
import Stats from "./components/Dashboard/Stats";
import AdminPanel from "./components/Dashboard/AdminPanel";
import ProtectedRoute from "./components/Common/ProtectedRoute";
import "./App.css";

function App() {
  return (
    <div className="App">
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected Dashboard Routes */}
        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute>
              <div className="dashboard-layout">
                <Sidebar />
                <div className="main-content">
                  <Navbar />
                  <Routes>
                    <Route path="upload" element={<Upload />} />
                    <Route path="live" element={<LiveCamera />} />
                    <Route path="history" element={<History />} />
                    <Route path="stats" element={<Stats />} />
                    <Route path="admin" element={<AdminPanel />} />
                  </Routes>
                </div>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
