import { useEffect, useRef, useState } from "react";
import api from "../../api/axios";

interface Project {
  _id: string;
  name: string;
  color?: string;
}

const ProjectSelector = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState(
    localStorage.getItem("activeProjectId") || ""
  );
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get("/projects").then((r) => setProjects(r.data.projects || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (id: string) => {
    setActiveProject(id);
    if (id) localStorage.setItem("activeProjectId", id);
    else localStorage.removeItem("activeProjectId");
    setOpen(false);
    window.dispatchEvent(new Event("project-changed"));
  };

  const activeLabel =
    activeProject
      ? projects.find((p) => p._id === activeProject)?.name ?? "Project"
      : "All Projects";

  return (
    <div ref={ref} style={{ position: "relative", marginLeft: 16 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          border: "1px solid rgba(255,255,255,0.25)",
          borderRadius: 6,
          background: "rgba(255,255,255,0.1)",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 500,
          color: "#fff",
          whiteSpace: "nowrap",
        }}
      >
        <span>📁</span>
        <span>{activeLabel}</span>
        <span style={{ fontSize: 10 }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            backgroundColor: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            zIndex: 1000,
            minWidth: 200,
            padding: "4px 0",
          }}
        >
          <div
            onClick={() => select("")}
            style={{
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: 13,
              color: "#374151",
              fontWeight: activeProject === "" ? 700 : 400,
              backgroundColor: activeProject === "" ? "#f0f9ff" : "transparent",
            }}
          >
            All Projects
          </div>
          {projects.map((p) => (
            <div
              key={p._id}
              onClick={() => select(p._id)}
              style={{
                padding: "8px 16px",
                cursor: "pointer",
                fontSize: 13,
                color: "#374151",
                fontWeight: activeProject === p._id ? 700 : 400,
                backgroundColor: activeProject === p._id ? "#f0f9ff" : "transparent",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: p.color || "#0088ff",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              {p.name}
            </div>
          ))}
          <div style={{ borderTop: "1px solid #e2e8f0", margin: "4px 0" }} />
          <div
            onClick={() => {
              const name = window.prompt("Enter project name:");
              if (name?.trim()) {
                api.post("/projects", { name: name.trim() }).then((r) => {
                  const proj = r.data.project;
                  setProjects((prev) => [...prev, proj]);
                  select(proj._id);
                });
              }
            }}
            style={{
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: 13,
              color: "#0088ff",
              fontWeight: 600,
            }}
          >
            + New Project
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectSelector;
