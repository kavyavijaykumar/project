import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { FaUpload, FaCamera, FaHistory, FaChartBar, FaUserShield } from "react-icons/fa";
import "./Dashboard.css";

function Sidebar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  return (
    <div className="sidebar">
      <h2 className="logo">CamouSense</h2>
      <nav>
        <NavLink to="/dashboard/upload" activeclassname="active">
          <FaUpload /> Upload
        </NavLink>
        <NavLink to="/dashboard/live" activeclassname="active">
          <FaCamera /> Live
        </NavLink>
        <NavLink to="/dashboard/history" activeclassname="active">
          <FaHistory /> History
        </NavLink>
        <NavLink to="/dashboard/stats" activeclassname="active">
          <FaChartBar /> Stats
        </NavLink>

        {localStorage.getItem("role") === "admin" && (
          <NavLink to="/dashboard/admin" activeclassname="active">
            <FaUserShield /> Admin
          </NavLink>
        )}
      </nav>

      <button className="logout-btn" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
}

export default Sidebar;
