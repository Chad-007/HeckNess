"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Signup() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isHovered, setIsHovered] = useState(false);
  const [isLoginHovered, setIsLoginHovered] = useState(false);
  const [usernameActive, setUsernameActive] = useState(false);
  const [passwordActive, setPasswordActive] = useState(false);
  const [confirmPasswordActive, setConfirmPasswordActive] = useState(false);
  const router = useRouter();

  const handleSignup = async () => {
    if (!username.trim() || !password.trim() || !confirmPassword.trim()) {
      alert("Please fill in all fields.");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    if (password.length < 3) {
      alert("Password must be at least 6 characters long.");
      return;
    }

    try {
      const res = await fetch("http://localhost:3005/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        alert("Account created successfully! Please login.");
        router.push("/login");
      } else {
        const error = await res.json();
        alert(error.error);
      }
    } catch (err) {
      console.error(err);
      alert("Signup failed");
    }
  };

  const pageStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
    overflow: 'hidden',
  };

  const formStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '30px',
    width: '420px',
    padding: '60px 50px',
    background: 'rgba(17, 17, 17, 0.95)',
    border: '1px solid #333',
    borderRadius: '8px',
    boxShadow: '0 25px 50px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)',
    backdropFilter: 'blur(10px)',
  };

  const headingStyle = {
    color: '#FFFFFF',
    fontSize: '3.8rem',
    fontWeight: '100',
    textAlign: 'center' as const,
    letterSpacing: '0.3rem',
    marginBottom: '40px',
    textTransform: 'uppercase' as const,
    textShadow: '0 2px 10px rgba(255,255,255,0.1)',
  };

  const inputContainerStyle = {
    position: 'relative' as const,
  };

  const inputStyle = {
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid #333',
    color: '#fff',
    fontSize: '1.2rem',
    padding: '18px 8px',
    outline: 'none',
    transition: 'all 0.3s ease',
    width: '100%',
    fontWeight: '300',
  };

  const inputFocusStyle = {
    borderBottom: '2px solid #fff',
    transform: 'scale(1.02)',
  };

  const labelStyle = {
    position: 'absolute' as const,
    top: '18px',
    left: '8px',
    color: '#777',
    fontSize: '1.2rem',
    transition: 'all 0.3s ease',
    pointerEvents: 'none' as const,
    fontWeight: '300',
  };

  const labelActiveStyle = {
    top: '-8px',
    fontSize: '0.9rem',
    color: '#fff',
    fontWeight: '400',
  };

  const buttonStyle = {
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
    color: '#FFFFFF',
    border: '2px solid #444',
    padding: '20px',
    fontSize: '1.1rem',
    fontWeight: '400',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.2rem',
    cursor: 'pointer',
    transition: 'all 0.4s ease',
    marginTop: '25px',
    borderRadius: '4px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
  };

  const buttonHoverStyle = {
    background: 'linear-gradient(135deg, #fff 0%, #f0f0f0 100%)',
    color: '#000',
    borderColor: '#fff',
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 25px rgba(255,255,255,0.2)',
  };

  const linkContainerStyle = {
    textAlign: 'center' as const,
    marginTop: '30px',
  };

  const linkTextStyle = {
    color: '#999',
    fontSize: '1rem',
  };

  const linkStyle = {
    color: '#FFFFFF',
    textDecoration: 'none',
    borderBottom: '1px solid transparent',
    transition: 'all 0.3s ease',
    padding: '10px 18px',
    display: 'inline-block',
    marginLeft: '10px',
    fontSize: '1rem',
    fontWeight: '300',
  };

  const linkHoverStyle = {
    borderBottom: '1px solid #fff',
    transform: 'translateY(-1px)',
  };

  return (
    <div style={pageStyle}>
      <div style={formStyle}>
        <h1 style={headingStyle}>Sign Up</h1>
        
        <div style={inputContainerStyle}>
          <input
            type="text"
            style={{ 
              ...inputStyle, 
              ...(usernameActive ? inputFocusStyle : {}) 
            }}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onFocus={() => setUsernameActive(true)}
            onBlur={() => setUsernameActive(username !== "")}
          />
          <label style={{ 
            ...labelStyle, 
            ...(usernameActive || username ? labelActiveStyle : {}) 
          }}>
            Username
          </label>
        </div>

        <div style={inputContainerStyle}>
          <input
            type="password"
            style={{ 
              ...inputStyle, 
              ...(passwordActive ? inputFocusStyle : {}) 
            }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setPasswordActive(true)}
            onBlur={() => setPasswordActive(password !== "")}
          />
          <label style={{ 
            ...labelStyle, 
            ...(passwordActive || password ? labelActiveStyle : {}) 
          }}>
            Password
          </label>
        </div>

        <div style={inputContainerStyle}>
          <input
            type="password"
            style={{ 
              ...inputStyle, 
              ...(confirmPasswordActive ? inputFocusStyle : {}) 
            }}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onFocus={() => setConfirmPasswordActive(true)}
            onBlur={() => setConfirmPasswordActive(confirmPassword !== "")}
          />
          <label style={{ 
            ...labelStyle, 
            ...(confirmPasswordActive || confirmPassword ? labelActiveStyle : {}) 
          }}>
            Confirm Password
          </label>
        </div>

        <button
          style={{ 
            ...buttonStyle, 
            ...(isHovered ? buttonHoverStyle : {}) 
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={handleSignup}
        >
          Create Account
        </button>

        <div style={linkContainerStyle}>
          <span style={linkTextStyle}>Already have an account?</span>
          <Link 
            href="/login" 
            style={{ 
              ...linkStyle, 
              ...(isLoginHovered ? linkHoverStyle : {}) 
            }}
            onMouseEnter={() => setIsLoginHovered(true)}
            onMouseLeave={() => setIsLoginHovered(false)}
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
