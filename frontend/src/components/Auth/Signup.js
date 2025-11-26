import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import "./Auth.css";

function Signup() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState("");

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirm) {
      setError("Passwords do not match.");
      return;
    }
    try {
      // Replace with actual backend endpoint (e.g., /register)
      await api.post(`/register`, {
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });
      navigate("/");
    } catch (err) {
      setError("Error creating account. Please try again.");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Create Account</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            name="username"
            placeholder="Username"
            required
            value={formData.username}
            onChange={handleChange}
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            required
            value={formData.email}
            onChange={handleChange}
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            value={formData.password}
            onChange={handleChange}
          />
          <input
            type="password"
            name="confirm"
            placeholder="Confirm Password"
            required
            value={formData.confirm}
            onChange={handleChange}
          />
          {error && <p className="error">{error}</p>}
          <button type="submit">Sign Up</button>
        </form>

        <p className="switch-text">
          Already have an account?{" "}
          <span onClick={() => navigate("/")}>Login</span>
        </p>
      </div>
    </div>
  );
}

export default Signup;
