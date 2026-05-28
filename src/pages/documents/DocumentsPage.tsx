// ─────────────────────────────────────────────
// DocumentsPage — upload UAT / SOW / BRD files for AI extraction
// Drag-and-drop zone, file history table, processing & error states
// ─────────────────────────────────────────────

import {
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type ChangeEvent,
} from "react";
import { uploadDocument } from "../../api/documents.api";
import {
  CloudUpload,
  FileSpreadsheet,
  FileText,
  FileType,
  X,
} from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import StatusBadge from "../../components/ui/StatusBadge";
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from "../../styles/tokens";

// ── Types ────────────────────────────────────────────────────

type FileKind = "excel" | "word" | "pdf";
type FileRowStatus = "processed" | "processing";

/** One row in the file history table */
interface DocumentFile {
  id: string;
  name: string;
  meta: string;
  kind: FileKind;
  typeLabel: string;
  client: string;
  uploaded: string;
  status: FileRowStatus;
  storiesCount?: number;
  progress?: number;
  progressLabel?: string;
}

const SUPPORTED_EXTENSIONS = [".docx", ".xlsx", ".pdf"];

// ── Initial table data (4 rows from spec) ────────────────────

const initialFiles: DocumentFile[] = [
  {
    id: "1",
    name: "UAT_Testing_V2.xlsx",
    meta: "47 rows · 3 sheets",
    kind: "excel",
    typeLabel: "Excel",
    client: "TechCorp Ltd",
    uploaded: "Today 2:15 PM",
    status: "processed",
    storiesCount: 14,
  },
  {
    id: "2",
    name: "Sprint14_BugReport.docx",
    meta: "12 pages",
    kind: "word",
    typeLabel: "Word",
    client: "GlobalRetail",
    uploaded: "Today 10:30 AM",
    status: "processed",
    storiesCount: 8,
  },
  {
    id: "3",
    name: "SOW_PlatformV2.pdf",
    meta: "23 pages",
    kind: "pdf",
    typeLabel: "PDF",
    client: "StartupXYZ",
    uploaded: "Just now",
    status: "processing",
    progress: 62,
    progressLabel: "62% — Reading pages...",
  },
  {
    id: "4",
    name: "Q1_UAT_Report.xlsx",
    meta: "31 rows · 2 sheets",
    kind: "excel",
    typeLabel: "Excel",
    client: "FinanceApp",
    uploaded: "Yesterday",
    status: "processed",
    storiesCount: 22,
  },
];

// Table column widths — FILE column grows; others stay compact
const TABLE_GRID =
  "minmax(220px, 2fr) 72px minmax(100px, 1fr) minmax(100px, 1fr) minmax(140px, 1.2fr) 88px minmax(200px, 1.5fr)";

const DocumentsPage = () => {
  // dragOver — true while user drags a file over the upload zone (tints bg blue)
  const [dragOver, setDragOver] = useState(false);
  // files — rows shown in the history table; can grow when valid files are dropped
  const [files, setFiles] = useState<DocumentFile[]>(initialFiles);
  // uploadError — set when unsupported type (e.g. .png); null when no error
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Drag-and-drop event handlers ───────────────────────────

  /** onDragOver — browser default is to reject drops; we must preventDefault and set dragOver */
  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(true);
  };

  /** onDragLeave — reset highlight when pointer leaves the drop zone (not child elements) */
  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const related = event.relatedTarget as Node | null;
    if (!event.currentTarget.contains(related)) {
      setDragOver(false);
    }
  };

  /** onDrop — read dropped files, validate extension, update state */
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);

    const dropped = event.dataTransfer.files[0];
    if (!dropped) return;

    processSelectedFile(dropped);
  };

  /** Shared logic for drop zone and hidden file input */
  const processSelectedFile = (file: File) => {
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith(".png") || !isSupportedFile(lowerName)) {
      setUploadError("wrong-type");
      return;
    }

    setUploadError(null);

    uploadDocument(file, "techcorp").catch(() => {
      /* offline dev — table row still shown from local state */
    });

    const kind = getKindFromName(lowerName);
    const newRow: DocumentFile = {
      id: `upload-${Date.now()}`,
      name: file.name,
      meta: formatFileSize(file.size),
      kind,
      typeLabel: kind === "excel" ? "Excel" : kind === "word" ? "Word" : "PDF",
      client: "—",
      uploaded: "Just now",
      status: "processing",
      progress: 12,
      progressLabel: "12% — Uploading...",
    };
    setFiles((prev) => [newRow, ...prev]);
  };

  /** Browse Files — opens native file picker via hidden <input type="file"> */
  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  /** onChange on hidden input — same validation as drop */
  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    if (picked) processSelectedFile(picked);
    event.target.value = "";
  };

  /** Try Again — clears error so user can upload again */
  const handleTryAgain = () => {
    setUploadError(null);
  };

  /** Cancel — removes in-progress row (row 3 demo) */
  const handleCancelProcessing = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <AppShell pageTitle="Documents">
      {/* ── PAGE HEADER ───────────────────────────────────── */}
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: spacing[4],
          marginBottom: spacing[6],
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin: `0 0 ${spacing[2]} 0`,
              fontSize: typography.titleXl.size,
              fontWeight: 700,
              color: colors["text-primary"],
            }}
          >
            Document Processing
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: typography.bodySm.size,
              fontWeight: typography.bodySm.weight,
              color: colors["text-secondary"],
              maxWidth: "520px",
            }}
          >
            Upload client UAT reports, SOW, BRD — AI extracts all requirements
            automatically
          </p>
        </div>
        <button type="button" style={btnGhost}>
          Upload History
        </button>
      </header>

      {/* ── UPLOAD ZONE ───────────────────────────────────── */}
      <div
        role="region"
        aria-label="Document upload"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          width: "100%",
          marginBottom: spacing[6],
          padding: spacing[12],
          textAlign: "center",
          border: `2px dashed ${colors["border-light"]}`,
          borderRadius: borderRadius["2xl"],
          backgroundColor: dragOver
            ? colors["surface-blue-tint"]
            : colors["surface-subtle"],
          transition: "background-color 0.15s ease",
          boxSizing: "border-box",
        }}
      >
        <CloudUpload
          size={48}
          color={colors["brand-blue"]}
          style={{ margin: "0 auto 16px" }}
        />
        <p
          style={{
            margin: `0 0 ${spacing[2]} 0`,
            fontSize: typography.titleMd.size,
            fontWeight: 700,
            color: colors["text-primary"],
          }}
        >
          Drop your document here
        </p>
        <p
          style={{
            margin: `0 0 ${spacing[4]} 0`,
            fontSize: typography.bodySm.size,
            color: colors["text-tertiary"],
          }}
        >
          or
        </p>
        <button type="button" onClick={handleBrowseClick} style={btnBrowse}>
          Browse Files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.xlsx,.pdf"
          style={{ display: "none" }}
          onChange={handleFileInputChange}
        />
        <p
          style={{
            margin: `${spacing[4]} 0 ${spacing[4]} 0`,
            fontSize: typography.captionSm.size,
            color: colors["text-tertiary"],
          }}
        >
          Supports .docx · .xlsx · .pdf — Max 50MB
        </p>
        <div style={tipBox}>
          <strong style={{ fontWeight: 600 }}>Tip:</strong> Upload your full UAT
          spreadsheet — AI reads every row and creates ADO stories
        </div>
      </div>

      {/* ── ERROR STATE (below upload zone when .png etc.) ─── */}
      {uploadError === "wrong-type" && (
        <div
          style={{
            marginBottom: spacing[6],
            padding: spacing[12],
            textAlign: "center",
            border: `2px solid ${colors.danger}`,
            borderRadius: borderRadius["2xl"],
            backgroundColor: "#fff5f5",
          }}
        >
          <X
            size={40}
            color={colors.danger}
            style={{ margin: "0 auto 12px" }}
          />
          <p
            style={{
              margin: `0 0 ${spacing[2]} 0`,
              fontSize: typography.titleMd.size,
              fontWeight: 700,
              color: colors.danger,
            }}
          >
            File type not supported
          </p>
          <p
            style={{
              margin: `0 0 ${spacing[5]} 0`,
              fontSize: typography.bodySm.size,
              color: colors["text-secondary"],
            }}
          >
            .png files cannot be processed · Supported: .docx · .xlsx · .pdf
          </p>
          <button type="button" onClick={handleTryAgain} style={btnBrowse}>
            Try Again
          </button>
        </div>
      )}

      {/* ── FILE TABLE ────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: colors["surface-card"],
          border: `1px solid ${colors["border-default"]}`,
          borderRadius: borderRadius.md,
          overflow: "hidden",
        }}
      >
        {/* Table header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: TABLE_GRID,
            alignItems: "center",
            padding: "10px 16px",
            backgroundColor: colors["surface-subtle"],
            borderBottom: `1px solid ${colors["border-default"]}`,
          }}
        >
          {[
            "FILE",
            "TYPE",
            "CLIENT",
            "UPLOADED",
            "STATUS",
            "STORIES",
            "ACTIONS",
          ].map((col) => (
            <span key={col} style={tableHeaderCell}>
              {col}
            </span>
          ))}
        </div>

        {/* Table body — one row per file in `files` state */}
        {files.map((file) => (
          <FileTableRow
            key={file.id}
            file={file}
            onCancel={() => handleCancelProcessing(file.id)}
          />
        ))}
      </div>
    </AppShell>
  );
};

// ── File table row ─────────────────────────────────────────────

function FileTableRow({
  file,
  onCancel,
}: {
  file: DocumentFile;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: TABLE_GRID,
        alignItems: "center",
        minHeight: "56px",
        padding: "8px 16px",
        borderBottom: `1px solid ${colors["border-default"]}`,
        gap: spacing[2],
      }}
    >
      {/* FILE — icon + name + meta */}
      <div style={{ display: "flex", alignItems: "center", gap: spacing[3] }}>
        <FileKindIcon kind={file.kind} />
        <div>
          <div
            style={{
              fontSize: typography.bodySm.size,
              fontWeight: 600,
              color: colors["text-primary"],
            }}
          >
            {file.name}
          </div>
          <div
            style={{
              fontSize: typography.captionSm.size,
              color: colors["text-tertiary"],
            }}
          >
            {file.meta}
          </div>
        </div>
      </div>

      {/* TYPE */}
      <span style={typeBadge}>{file.typeLabel}</span>

      {/* CLIENT */}
      <span style={cellText}>{file.client}</span>

      {/* UPLOADED */}
      <span style={cellText}>{file.uploaded}</span>

      {/* STATUS */}
      <div>
        {file.status === "processed" && (
          <StatusBadge variant="healthy" label="Processed" />
        )}
        {file.status === "processing" && (
          <div>
            <div
              style={{
                width: "120px",
                height: "4px",
                backgroundColor: colors["border-default"],
                borderRadius: borderRadius.full,
                overflow: "hidden",
                marginBottom: spacing[1],
              }}
            >
              <div
                className="doc-progress-fill"
                style={{
                  width: `${file.progress ?? 0}%`,
                  height: "100%",
                  backgroundColor: colors["brand-blue"],
                  borderRadius: borderRadius.full,
                }}
              />
            </div>
            <span
              style={{
                fontSize: typography.captionSm.size,
                color: colors.warning,
              }}
            >
              {file.progressLabel}
            </span>
          </div>
        )}
      </div>

      {/* STORIES */}
      <div>
        {file.storiesCount != null ? (
          <button type="button" style={storiesLink}>
            {file.storiesCount} stories
          </button>
        ) : (
          <span style={{ color: colors["text-tertiary"], fontSize: typography.captionSm.size }}>
            —
          </span>
        )}
      </div>

      {/* ACTIONS */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: spacing[2],
          alignItems: "center",
        }}
      >
        {file.status === "processed" && (
          <>
            <button type="button" style={btnOutlineBlue}>
              View Stories
            </button>
            {file.id === "1" && (
              <button type="button" style={btnGhostSm}>
                Re-process
              </button>
            )}
          </>
        )}
        {file.status === "processing" && (
          <button type="button" onClick={onCancel} style={btnGhostSm}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ── File kind icon (colored square + Lucide icon) ─────────────

function FileKindIcon({ kind }: { kind: FileKind }) {
  const config = {
    excel: {
      bg: colors["success-bg"],
      color: colors["success-dark"],
      Icon: FileSpreadsheet,
    },
    word: {
      bg: colors["info-bg"],
      color: colors.info,
      Icon: FileText,
    },
    pdf: {
      bg: colors["danger-bg"],
      color: colors.danger,
      Icon: FileType,
    },
  }[kind];

  const { bg, color, Icon } = config;

  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: borderRadius.md,
        backgroundColor: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon size={20} color={color} />
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────

function isSupportedFile(name: string): boolean {
  return SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function getKindFromName(name: string): FileKind {
  if (name.endsWith(".xlsx")) return "excel";
  if (name.endsWith(".docx")) return "word";
  return "pdf";
}

function formatFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

// ── Shared styles ────────────────────────────────────────────

const tableHeaderCell: CSSProperties = {
  fontSize: typography.tableHeader.size,
  fontWeight: typography.tableHeader.weight,
  color: colors["text-tertiary"],
  textTransform: "uppercase",
};

const cellText: CSSProperties = {
  fontSize: typography.bodySm.size,
  color: colors["text-primary"],
};

const typeBadge: CSSProperties = {
  display: "inline-block",
  fontSize: typography.captionSm.size,
  fontWeight: 500,
  padding: "2px 8px",
  borderRadius: borderRadius.sm,
  backgroundColor: colors.canvas,
  color: colors["text-secondary"],
};

const btnGhost: CSSProperties = {
  padding: `${spacing[2]} ${spacing[4]}`,
  backgroundColor: "transparent",
  border: `1px solid ${colors["border-default"]}`,
  borderRadius: borderRadius.md,
  fontSize: typography.bodySm.size,
  fontWeight: 500,
  color: colors["text-secondary"],
  cursor: "pointer",
};

const btnGhostSm: CSSProperties = {
  ...btnGhost,
  padding: `${spacing[1]} ${spacing[3]}`,
  fontSize: typography.captionSm.size,
};

const btnBrowse: CSSProperties = {
  height: "44px",
  padding: `0 ${spacing[6]}`,
  backgroundColor: colors["brand-blue"],
  color: colors["text-on-dark"],
  border: "none",
  borderRadius: borderRadius.md,
  fontSize: typography.bodySm.size,
  fontWeight: 600,
  cursor: "pointer",
};

const btnOutlineBlue: CSSProperties = {
  padding: `${spacing[1]} ${spacing[3]}`,
  backgroundColor: "transparent",
  border: `1px solid ${colors.info}`,
  borderRadius: borderRadius.md,
  fontSize: typography.captionSm.size,
  fontWeight: 600,
  color: colors.info,
  cursor: "pointer",
};

const storiesLink: CSSProperties = {
  border: "none",
  background: "none",
  padding: 0,
  fontSize: typography.captionSm.size,
  fontWeight: 600,
  color: colors.info,
  cursor: "pointer",
  textDecoration: "underline",
};

const tipBox: CSSProperties = {
  display: "inline-block",
  maxWidth: "480px",
  backgroundColor: colors["surface-blue-tint"],
  borderRadius: borderRadius.md,
  padding: "10px",
  fontSize: typography.captionSm.size,
  color: colors["text-secondary"],
  textAlign: "left",
};

export default DocumentsPage;
