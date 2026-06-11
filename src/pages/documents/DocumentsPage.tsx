import { useEffect, useRef, useState } from "react";
import AppShell from "../../components/layout/AppShell";
import api from "../../api/axios";

interface AnalysisResult {
  success: boolean;
  documentTitle?: string;
  documentSummary?: string;
  storiesCreated: number;
  totalRequirements?: number;
  stories?: {
    _id: string;
    storyTitle: string;
    type: string;
    priority: string;
    acceptanceCriteria?: string[];
  }[];
}

interface DocumentRecord {
  _id: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  storiesCreated: number;
  status: string;
  createdAt: string;
}

const STEPS = [
  "Reading document...",
  "Extracting text content...",
  "Analyzing requirements with Claude AI...",
  "Generating structured stories...",
  "Saving to Review Queue...",
];

const fileIcon = (type: string) =>
  type === "pdf" ? "📕" : type === "docx" ? "📘" : type === "xlsx" ? "📗" : "📄";

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function DocumentsPage() {
  const [selectedFile, setSelectedFile]     = useState<File | null>(null);
  const [isDragging, setIsDragging]         = useState(false);
  const [isAnalyzing, setIsAnalyzing]       = useState(false);
  const [stepIndex, setStepIndex]           = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError]                   = useState<string | null>(null);
  const [documents, setDocuments]           = useState<DocumentRecord[]>([]);
  const fileInputRef                        = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    try {
      const res = await api.get("/documents");
      setDocuments(res.data.documents ?? []);
    } catch {
      // silently ignore — list is optional
    }
  };

  useEffect(() => { fetchDocuments(); }, []);

  const validate = (file: File): string | null => {
    const allowed = [".docx", ".pdf", ".xlsx", ".xls", ".txt", ".csv"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowed.includes(ext)) return "Please upload a .docx, .pdf, .xlsx, or .txt file";
    if (file.size > 10 * 1024 * 1024) return "File size must be under 10 MB";
    return null;
  };

  const handleFileSelect = (file: File) => {
    const err = validate(file);
    if (err) { setError(err); return; }
    setSelectedFile(file);
    setError(null);
    setAnalysisResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);
    setStepIndex(0);

    const iv = setInterval(() => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1)), 3000);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await api.post("/documents/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 300000, // 5 min — multi-chunk documents take longer
      });

      if (res.data.success) {
        setAnalysisResult(res.data);
        fetchDocuments();
      } else {
        setError(res.data.message ?? "Analysis failed. Please try again.");
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "Failed to analyze document. Please try again.");
    } finally {
      clearInterval(iv);
      setIsAnalyzing(false);
    }
  };

  return (
    <AppShell pageTitle="Documents">
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1e293b", margin: 0 }}>
            Document Analysis
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: "6px 0 0" }}>
            Upload PRD, UAT, or requirement documents — AI analyzes and creates ADO stories automatically
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !selectedFile && fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? "#0088ff" : selectedFile ? "#16a34a" : "#cbd5e1"}`,
            borderRadius: 16,
            padding: 48,
            textAlign: "center",
            backgroundColor: isDragging ? "#eff6ff" : selectedFile ? "#f0fdf4" : "#f8fafc",
            cursor: selectedFile ? "default" : "pointer",
            transition: "all 0.2s",
            marginBottom: 20,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.pdf,.xlsx,.xls,.txt,.csv"
            style={{ display: "none" }}
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          />

          {!selectedFile ? (
            <>
              <div style={{ fontSize: 48, marginBottom: 14 }}>📄</div>
              <p style={{ fontSize: 18, fontWeight: 600, color: "#1e293b", margin: "0 0 6px" }}>
                Drop your document here
              </p>
              <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 16px" }}>
                or click to browse
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                {[".docx", ".pdf", ".xlsx", ".txt"].map((ext) => (
                  <span key={ext} style={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, padding: "3px 10px", fontSize: 12, color: "#64748b", fontWeight: 500 }}>
                    {ext}
                  </span>
                ))}
              </div>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: "12px 0 0" }}>
                Allowed: .docx .pdf .xlsx .txt · Max file size: 10MB
              </p>
              <p style={{ fontSize: 13, color: "#64748b", margin: "14px 0 0", lineHeight: 1.5 }}>
                AI will analyze your document and create structured ADO stories automatically
              </p>
            </>
          ) : (
            <>
              <div style={{ fontSize: 48, marginBottom: 10 }}>✅</div>
              <p style={{ fontSize: 16, fontWeight: 600, color: "#16a34a", margin: "0 0 4px" }}>
                {selectedFile.name}
              </p>
              <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>
                {formatSize(selectedFile.size)}
              </p>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setAnalysisResult(null); setError(null); }}
                style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13, color: "#64748b" }}
              >
                Remove file
              </button>
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 16px", marginBottom: 16, color: "#dc2626", fontSize: 14 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Analyze button */}
        {selectedFile && !isAnalyzing && !analysisResult && (
          <button
            type="button"
            onClick={handleAnalyze}
            style={{ width: "100%", backgroundColor: "#0088ff", color: "#fff", border: "none", borderRadius: 10, padding: 14, fontSize: 16, fontWeight: 600, cursor: "pointer", marginBottom: 24 }}
          >
            🤖 Analyze Document with AI
          </button>
        )}

        {/* Loading */}
        {isAnalyzing && (
          <div style={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 32, textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>⚙️</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#1e293b", margin: "0 0 6px" }}>Analyzing document…</p>
            <p style={{ fontSize: 14, color: "#0088ff", margin: "0 0 20px" }}>{STEPS[stepIndex]}</p>
            <div style={{ height: 4, backgroundColor: "#f1f5f9", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ height: 4, backgroundColor: "#0088ff", borderRadius: 999, width: `${((stepIndex + 1) / STEPS.length) * 100}%`, transition: "width 0.5s ease" }} />
            </div>
            <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 12 }}>
              This may take 30–60 seconds for large documents
            </p>
          </div>
        )}

        {/* Result */}
        {analysisResult && (() => {
          const totalAC =
            analysisResult.stories?.reduce(
              (sum, s) => sum + (s.acceptanceCriteria?.length || 0),
              0,
            ) ?? 0;
          const bugCount =
            analysisResult.stories?.filter((s) => s.type === "Bug").length ?? 0;

          return (
          <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, padding: 24, marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: 32 }}>🎉</span>
              <div>
                <p style={{ fontSize: 18, fontWeight: 700, color: "#16a34a", margin: 0 }}>Analysis Complete!</p>
                <p style={{ fontSize: 14, color: "#166534", margin: "2px 0 0" }}>
                  {analysisResult.storiesCreated} stories created with {totalAC} acceptance criteria from {selectedFile?.name}
                </p>
              </div>
            </div>

            {analysisResult.documentSummary && (
              <div style={{ backgroundColor: "#fff", borderRadius: 8, padding: 14, marginBottom: 14, fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
                <strong>Summary:</strong> {analysisResult.documentSummary}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              {[
                { label: "Stories", value: analysisResult.storiesCreated, color: "#0088ff" },
                { label: "Acceptance Criteria", value: totalAC, color: "#0d9488" },
                { label: "Bugs", value: bugCount, color: "#dc2626" },
                { label: "Features", value: analysisResult.stories?.filter((s) => s.type === "Feature").length ?? 0, color: "#7c3aed" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ backgroundColor: "#fff", borderRadius: 8, padding: "12px 16px", textAlign: "center", flex: 1 }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
                </div>
              ))}
            </div>

            {analysisResult.stories && analysisResult.stories.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Stories created:</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 220, overflowY: "auto" }}>
                  {analysisResult.stories.map((s, i) => (
                    <div key={i} style={{ backgroundColor: "#fff", borderRadius: 6, padding: "7px 12px", fontSize: 13, color: "#374151", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ backgroundColor: s.type === "Bug" ? "#fef2f2" : "#eff6ff", color: s.type === "Bug" ? "#dc2626" : "#2563eb", padding: "1px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                        {s.type}
                      </span>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.storyTitle}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => { window.location.href = "/review"; }}
              style={{ width: "100%", backgroundColor: "#16a34a", color: "#fff", border: "none", borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              View Stories in Review Queue →
            </button>
          </div>
          );
        })()}

        {/* Previously analyzed documents */}
        {documents.length > 0 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 14 }}>
              Previously Analyzed Documents
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {documents.map((doc) => (
                <div key={doc._id} style={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 24 }}>{fileIcon(doc.fileType)}</span>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", margin: 0 }}>{doc.originalName}</p>
                      <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>
                        {new Date(doc.createdAt).toLocaleDateString()} · {formatSize(doc.fileSize)}
                      </p>
                    </div>
                  </div>
                  <span style={{ backgroundColor: "#f0fdf4", color: "#16a34a", padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                    ✅ {doc.storiesCreated} stories
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
