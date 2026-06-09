import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { HomePage }   from "./components/HomePage";
import { UploadPage } from "./components/UploadPage";
import { WatchPage }  from "./components/WatchPage";

function Nav() {
  return (
    <nav style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 28px", background: "#141414",
      borderBottom: "1px solid #222", position: "sticky", top: 0, zIndex: 100,
    }}>
      <Link to="/" style={{ textDecoration: "none" }}>
        <span style={{
          fontWeight: 900, fontSize: 22, color: "#e50914",
          letterSpacing: "-1px",
        }}>
          StreamFlow
        </span>
      </Link>
      <Link to="/upload" style={{
        padding: "8px 20px", background: "#e50914", color: "#fff",
        borderRadius: 5, textDecoration: "none", fontWeight: 600, fontSize: 14,
      }}>
        + Upload Video
      </Link>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/"          element={<HomePage />} />
        <Route path="/upload"    element={<UploadPage />} />
        <Route path="/watch/:id" element={<WatchPage />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
