"use client";

import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle2, AlertTriangle, Clock, XCircle, Loader2 } from "lucide-react";

interface Doc {
  id: string;
  filename: string;
  mime: string;
  size: number;
  scanStatus: string;
  docType: string | null;
  state: string | null;
  note: string | null;
  uploadedAt: string;
}

const DOC_TYPES = [
  { value: "resale_cert", label: "Resale Certificate" },
  { value: "business_license", label: "Business License" },
  { value: "tax_exempt", label: "Tax Exemption Certificate" },
  { value: "other", label: "Other" },
];

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire",
  "New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio",
  "Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota",
  "Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia",
  "Wisconsin","Wyoming",
];

export default function DocumentUploader({ initialDocuments }: { initialDocuments: Doc[] }) {
  const [documents, setDocuments] = useState<Doc[]>(initialDocuments);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File, docType: string, state: string) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("docType", docType);
      if (state) formData.append("state", state);

      const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Upload failed");
      }

      const newDoc = await res.json();
      setDocuments((prev) => [
        { ...newDoc, mime: file.type, size: file.size, docType, state: state || null, note: null, uploadedAt: new Date().toISOString() },
        ...prev,
      ]);
      toast.success("Document uploaded", { description: "Scanning for viruses..." });
      pollScanStatus(newDoc.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const pollScanStatus = useCallback(async (docId: string) => {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const res = await fetch("/api/documents");
        if (!res.ok) continue;
        const body = await res.json();
        const updated = body.documents?.find((d: Doc) => d.id === docId);
        if (updated && updated.scanStatus !== "PENDING" && updated.scanStatus !== "SCANNING") {
          setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, scanStatus: updated.scanStatus } : d)));
          if (updated.scanStatus === "CLEAN") toast.success("Document scan clean");
          else toast.error("Document flagged as infected");
          return;
        }
      } catch { /* continue polling */ }
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file, "other", "");
  }, [uploadFile]);

  const handleFormSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("file") as File;
    const docType = (form.get("docType") as string) || "other";
    const state = (form.get("state") as string) || "";
    if (!file || file.size === 0) { toast.error("Please select a file"); return; }
    await uploadFile(file, docType, state);
    (e.target as HTMLFormElement).reset();
  }, [uploadFile]);

  const selectClass = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

  return (
    <div className="space-y-6">
      {/* Upload Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Upload a Document</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
            >
              <Upload className="mx-auto mb-2 text-muted-foreground" size={32} />
              <p className="text-sm text-muted-foreground">Drag & drop a file here, or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, JPEG, PNG, WebP, GIF — Max 10 MB</p>
              <input ref={fileInputRef} type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.gif" className="hidden" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="docType">Document Type</Label>
                <select id="docType" name="docType" className={selectClass}>
                  {DOC_TYPES.map((dt) => (<option key={dt.value} value={dt.value}>{dt.label}</option>))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State (if applicable)</Label>
                <select id="state" name="state" className={selectClass}>
                  <option value="">Select...</option>
                  {US_STATES.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
              </div>
            </div>

            <Button type="submit" disabled={uploading}>
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin" />Uploading...</> : "Upload Document"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Document List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your Documents ({documents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="py-8 text-center">
              <FileText className="mx-auto mb-3 text-muted-foreground" size={36} />
              <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
            </div>
          ) : (
            <div className="divide-y rounded-lg border overflow-hidden">
              {documents.map((doc) => (
                <div key={doc.id} className="px-4 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.filename}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {doc.docType && DOC_TYPES.find((d) => d.value === doc.docType)?.label}
                      {doc.state && ` — ${doc.state}`}
                      {" · "}{formatBytes(doc.size)}
                    </p>
                  </div>
                  <ScanBadge status={doc.scanStatus} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ScanBadge({ status }: { status: string }) {
  switch (status) {
    case "CLEAN": return <Badge className="bg-success text-white"><CheckCircle2 size={12} className="mr-1" />Clean</Badge>;
    case "INFECTED": return <Badge variant="destructive"><XCircle size={12} className="mr-1" />Infected</Badge>;
    case "SCANNING": return <Badge variant="secondary"><Clock size={12} className="mr-1" />Scanning</Badge>;
    default: return <Badge variant="outline"><AlertTriangle size={12} className="mr-1" />Pending</Badge>;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
