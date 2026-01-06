"use client";

import { useState, useRef, useCallback } from "react";
import { PDFDocument } from "pdf-lib";

interface PdfInfo {
  name: string;
  pageCount: number;
  size: string;
  data: ArrayBuffer;
}

export default function Home() {
  const [pdfInfo, setPdfInfo] = useState<PdfInfo | null>(null);
  const [startPage, setStartPage] = useState<number>(1);
  const [endPage, setEndPage] = useState<number>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const loadPdf = useCallback(async (file: File) => {
    setError(null);
    setIsProcessing(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const pageCount = pdf.getPageCount();

      setPdfInfo({
        name: file.name,
        pageCount,
        size: formatFileSize(file.size),
        data: arrayBuffer,
      });
      setStartPage(1);
      setEndPage(pageCount);
    } catch {
      setError("Unable to read this file. Please ensure it's a valid PDF.");
      setPdfInfo(null);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      loadPdf(file);
    } else if (file) {
      setError("Please select a PDF file.");
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file && file.type === "application/pdf") {
        loadPdf(file);
      } else if (file) {
        setError("Please drop a PDF file.");
      }
    },
    [loadPdf]
  );

  const extractPages = async () => {
    if (!pdfInfo) return;

    setError(null);
    setIsProcessing(true);

    try {
      const sourcePdf = await PDFDocument.load(pdfInfo.data);
      const newPdf = await PDFDocument.create();

      const start = startPage - 1;
      const end = endPage - 1;

      const pageIndices = [];
      for (let i = start; i <= end; i++) {
        pageIndices.push(i);
      }

      const pages = await newPdf.copyPages(sourcePdf, pageIndices);
      pages.forEach((page) => newPdf.addPage(page));

      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      const baseName = pdfInfo.name.replace(".pdf", "");
      link.download = `${baseName}_pages_${startPage}-${endPage}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const isValidRange =
    pdfInfo &&
    startPage >= 1 &&
    endPage >= startPage &&
    endPage <= pdfInfo.pageCount;

  const resetFile = () => {
    setPdfInfo(null);
    setStartPage(1);
    setEndPage(1);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const pageCount = isValidRange ? endPage - startPage + 1 : 0;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Subtle texture */}
      <div className="texture-overlay" />

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-xl">
          {/* Header */}
          <header className="text-center mb-16 animate-fade-up">
            <span className="decorative-line mb-6" />
            <h1
              className="text-4xl md:text-5xl mb-4 tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Page Extractor
            </h1>
            <p className="text-[var(--muted)] text-lg">
              Select and extract pages from any PDF
            </p>
          </header>

          {/* Upload State */}
          {!pdfInfo ? (
            <div className="animate-fade-up delay-1" style={{ opacity: 0 }}>
              <div
                className={`drop-zone card p-16 text-center cursor-pointer ${
                  isDragging ? "dragging" : ""
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {isProcessing ? (
                  <div className="animate-fade-in">
                    <div className="w-12 h-12 mx-auto mb-6 relative">
                      <div className="absolute inset-0 border-2 border-[var(--border)] rounded-full" />
                      <div className="absolute inset-0 border-2 border-transparent border-t-[var(--accent)] rounded-full animate-spin" />
                    </div>
                    <p className="text-[var(--muted)]">Reading PDF...</p>
                  </div>
                ) : (
                  <>
                    {/* Document icon */}
                    <div className="w-16 h-20 mx-auto mb-8 relative animate-float">
                      <div className="absolute inset-0 bg-[var(--card-bg)] border border-[var(--border)] rounded shadow-sm" />
                      <div className="absolute top-0 right-0 w-4 h-4 bg-[var(--background)] border-l border-b border-[var(--border)]" />
                      <div className="absolute bottom-4 left-3 right-3 space-y-1.5">
                        <div className="h-1 bg-[var(--border)] rounded-full" />
                        <div className="h-1 bg-[var(--border)] rounded-full w-4/5" />
                        <div className="h-1 bg-[var(--border)] rounded-full w-3/5" />
                      </div>
                    </div>

                    <p className="text-lg mb-2">
                      {isDragging ? "Drop it here" : "Drop your PDF here"}
                    </p>
                    <p className="text-[var(--muted)] text-sm">
                      or click to browse files
                    </p>
                  </>
                )}
              </div>

              {error && (
                <div
                  className="mt-6 p-4 rounded-lg bg-[var(--error-light)] animate-fade-in"
                  role="alert"
                >
                  <p className="text-[var(--error)] text-sm text-center">
                    {error}
                  </p>
                </div>
              )}

              {/* Privacy note */}
              <p className="text-center text-xs text-[var(--muted-light)] mt-10">
                Your files never leave your browser
              </p>
            </div>
          ) : (
            /* Processing State */
            <div className="animate-scale-in" style={{ opacity: 0 }}>
              <div className="card overflow-hidden">
                {/* File header */}
                <div className="p-6 border-b border-[var(--border)]">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      {/* PDF icon */}
                      <div className="w-12 h-14 flex-shrink-0 relative">
                        <div className="absolute inset-0 bg-[var(--accent-light)] border border-[var(--accent-muted)] rounded" />
                        <span
                          className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-[var(--accent)] uppercase tracking-wide"
                        >
                          PDF
                        </span>
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-medium truncate" title={pdfInfo.name}>
                          {pdfInfo.name}
                        </h2>
                        <p className="text-sm text-[var(--muted)]">
                          {pdfInfo.pageCount} page{pdfInfo.pageCount !== 1 && "s"}{" "}
                          <span className="text-[var(--border)]">·</span>{" "}
                          {pdfInfo.size}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={resetFile}
                      className="p-2 -m-2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                      aria-label="Remove file"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Range selection */}
                <div className="p-6 space-y-6">
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-4">
                      Page Range
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <input
                          type="number"
                          min={1}
                          max={pdfInfo.pageCount}
                          value={startPage}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            setStartPage(
                              Math.max(1, Math.min(val, pdfInfo.pageCount))
                            );
                          }}
                          className="input text-center text-lg"
                          aria-label="Start page"
                        />
                      </div>
                      <span className="text-[var(--muted-light)] font-light">
                        to
                      </span>
                      <div className="flex-1">
                        <input
                          type="number"
                          min={1}
                          max={pdfInfo.pageCount}
                          value={endPage}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            setEndPage(
                              Math.max(1, Math.min(val, pdfInfo.pageCount))
                            );
                          }}
                          className="input text-center text-lg"
                          aria-label="End page"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setStartPage(1);
                        setEndPage(pdfInfo.pageCount);
                      }}
                      className="btn btn-secondary"
                    >
                      All
                    </button>
                    <button
                      onClick={() => {
                        setStartPage(1);
                        setEndPage(1);
                      }}
                      className="btn btn-secondary"
                    >
                      First
                    </button>
                    <button
                      onClick={() => {
                        setStartPage(pdfInfo.pageCount);
                        setEndPage(pdfInfo.pageCount);
                      }}
                      className="btn btn-secondary"
                    >
                      Last
                    </button>
                    {pdfInfo.pageCount > 2 && (
                      <button
                        onClick={() => {
                          setStartPage(1);
                          setEndPage(Math.ceil(pdfInfo.pageCount / 2));
                        }}
                        className="btn btn-secondary"
                      >
                        First half
                      </button>
                    )}
                  </div>

                  {/* Summary */}
                  <div className="flex items-center justify-between py-4 border-t border-b border-[var(--border)]">
                    <span className="text-[var(--muted)]">Selected</span>
                    <span className="font-medium">
                      {isValidRange ? (
                        <>
                          {pageCount} page{pageCount !== 1 && "s"}
                        </>
                      ) : (
                        <span className="text-[var(--error)]">Invalid range</span>
                      )}
                    </span>
                  </div>

                  {error && (
                    <div
                      className="p-4 rounded-lg bg-[var(--error-light)] animate-fade-in"
                      role="alert"
                    >
                      <p className="text-[var(--error)] text-sm text-center">
                        {error}
                      </p>
                    </div>
                  )}

                  {/* Action */}
                  <button
                    onClick={extractPages}
                    disabled={!isValidRange || isProcessing}
                    className="btn btn-primary w-full"
                  >
                    {isProcessing ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                        Download PDF
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
