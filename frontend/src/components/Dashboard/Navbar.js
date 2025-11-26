import React from "react";
import { useLocation } from "react-router-dom";
import "./Dashboard.css";

function Navbar() {
  const location = useLocation();
  const page = location.pathname.split("/").pop();

  const formatTitle = (text) => text.charAt(0).toUpperCase() + text.slice(1);

  return (
    <div className="navbar">
      <h2>{formatTitle(page || "Dashboard")}</h2>
      <p className="role">
        Role: <span>{localStorage.getItem("role") || "Guest"}</span>
      </p>
    </div>
  );
}

export default Navbar;
