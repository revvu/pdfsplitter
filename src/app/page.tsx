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
      setError("Failed to load PDF. Please make sure the file is a valid PDF.");
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
      setError("Please select a valid PDF file.");
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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      loadPdf(file);
    } else if (file) {
      setError("Please drop a valid PDF file.");
    }
  }, [loadPdf]);

  const extractPages = async () => {
    if (!pdfInfo) return;

    setError(null);
    setIsProcessing(true);

    try {
      const sourcePdf = await PDFDocument.load(pdfInfo.data);
      const newPdf = await PDFDocument.create();

      // Convert to 0-indexed
      const start = startPage - 1;
      const end = endPage - 1;

      const pageIndices = [];
      for (let i = start; i <= end; i++) {
        pageIndices.push(i);
      }

      const pages = await newPdf.copyPages(sourcePdf, pageIndices);
      pages.forEach((page) => newPdf.addPage(page));

      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
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
      setError("Failed to extract pages. Please try again.");
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

  return (
    <div className="min-h-screen bg-[var(--background)] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 mb-4">
            <svg
              className="w-8 h-8 text-indigo-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">
            PDF Page Extractor
          </h1>
          <p className="text-[var(--muted)]">
            Extract specific pages from your PDF files
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-[var(--card-bg)] rounded-2xl shadow-xl border border-[var(--border)] overflow-hidden">
          {/* Upload Section */}
          {!pdfInfo ? (
            <div className="p-8">
              <div
                className={`drop-zone relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "dragging border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
                    : "border-[var(--border)] hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
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
                  <div className="animate-pulse-slow">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-indigo-500 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    </div>
                    <p className="text-[var(--muted)]">Loading PDF...</p>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-indigo-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                    </div>
                    <p className="text-[var(--foreground)] font-medium mb-1">
                      {isDragging
                        ? "Drop your PDF here"
                        : "Drag and drop your PDF here"}
                    </p>
                    <p className="text-[var(--muted)] text-sm">
                      or click to browse
                    </p>
                  </>
                )}
              </div>

              {error && (
                <div className="mt-4 p-4 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                  <p className="text-red-600 dark:text-red-400 text-sm">
                    {error}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="animate-fade-in">
              {/* File Info */}
              <div className="p-6 border-b border-[var(--border)]">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-6 h-6 text-red-500"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z" />
                        <path d="M8 14h8v2H8zm0 3h8v2H8z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-[var(--foreground)] truncate">
                        {pdfInfo.name}
                      </h3>
                      <p className="text-sm text-[var(--muted)]">
                        {pdfInfo.pageCount} pages &middot; {pdfInfo.size}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={resetFile}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    title="Remove file"
                  >
                    <svg
                      className="w-5 h-5 text-[var(--muted)]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Page Range Selection */}
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-4">
                    Select Page Range
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-xs text-[var(--muted)] mb-1.5">
                        Start Page
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={pdfInfo.pageCount}
                        value={startPage}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setStartPage(Math.max(1, Math.min(val, pdfInfo.pageCount)));
                        }}
                        className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <div className="pt-6 text-[var(--muted)]">to</div>
                    <div className="flex-1">
                      <label className="block text-xs text-[var(--muted)] mb-1.5">
                        End Page
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={pdfInfo.pageCount}
                        value={endPage}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setEndPage(Math.max(1, Math.min(val, pdfInfo.pageCount)));
                        }}
                        className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Quick Select Buttons */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setStartPage(1);
                      setEndPage(pdfInfo.pageCount);
                    }}
                    className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-slate-700 text-[var(--foreground)] hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    All Pages
                  </button>
                  <button
                    onClick={() => {
                      setStartPage(1);
                      setEndPage(1);
                    }}
                    className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-slate-700 text-[var(--foreground)] hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    First Page
                  </button>
                  <button
                    onClick={() => {
                      setStartPage(pdfInfo.pageCount);
                      setEndPage(pdfInfo.pageCount);
                    }}
                    className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-slate-700 text-[var(--foreground)] hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    Last Page
                  </button>
                  {pdfInfo.pageCount > 1 && (
                    <button
                      onClick={() => {
                        setStartPage(1);
                        setEndPage(Math.ceil(pdfInfo.pageCount / 2));
                      }}
                      className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-slate-700 text-[var(--foreground)] hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                      First Half
                    </button>
                  )}
                </div>

                {/* Selection Info */}
                <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-indigo-700 dark:text-indigo-300">
                      Pages to extract:
                    </span>
                    <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                      {isValidRange
                        ? `${endPage - startPage + 1} page${endPage - startPage + 1 !== 1 ? "s" : ""}`
                        : "Invalid range"}
                    </span>
                  </div>
                </div>

                {error && (
                  <div className="p-4 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                    <p className="text-red-600 dark:text-red-400 text-sm">
                      {error}
                    </p>
                  </div>
                )}

                {/* Extract Button */}
                <button
                  onClick={extractPages}
                  disabled={!isValidRange || isProcessing}
                  className="w-full py-4 px-6 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <svg
                        className="w-5 h-5 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      Extract & Download PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-[var(--muted)] mt-8">
          Your files are processed locally and never uploaded to any server.
        </p>
      </div>
    </div>
  );
}
