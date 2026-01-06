"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { PDFDocument } from "pdf-lib";
import dynamic from "next/dynamic";

// Dynamically import react-pdf to avoid SSR issues
const Document = dynamic(
  () => import("react-pdf").then((mod) => mod.Document),
  { ssr: false }
);
const Page = dynamic(() => import("react-pdf").then((mod) => mod.Page), {
  ssr: false,
});

// Import styles
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

interface PdfInfo {
  name: string;
  pageCount: number;
  size: string;
  data: ArrayBuffer;
  url: string;
}

// Configure pdf.js worker on client side
if (typeof window !== "undefined") {
  import("react-pdf").then((pdfjs) => {
    pdfjs.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.pdfjs.version}/build/pdf.worker.min.mjs`;
  });
}

export default function Home() {
  const [pdfInfo, setPdfInfo] = useState<PdfInfo | null>(null);
  const [startPage, setStartPage] = useState<number>(1);
  const [endPage, setEndPage] = useState<number>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

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

      // Create blob URL for react-pdf
      const blob = new Blob([arrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      setPdfInfo({
        name: file.name,
        pageCount,
        size: formatFileSize(file.size),
        data: arrayBuffer,
        url,
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
    if (pdfInfo?.url) {
      URL.revokeObjectURL(pdfInfo.url);
    }
    setPdfInfo(null);
    setStartPage(1);
    setEndPage(1);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const selectedPageCount = isValidRange ? endPage - startPage + 1 : 0;

  const pageNumbers = useMemo(() => {
    if (!pdfInfo) return [];
    return Array.from({ length: pdfInfo.pageCount }, (_, i) => i + 1);
  }, [pdfInfo]);

  const isPageSelected = useCallback(
    (pageNum: number) => {
      return pageNum >= startPage && pageNum <= endPage;
    },
    [startPage, endPage]
  );

  const isPageVisible = useCallback(
    (pageNum: number) => {
      return pageNum >= startPage && pageNum <= endPage;
    },
    [startPage, endPage]
  );

  // Auto-scroll to start page when it changes
  useEffect(() => {
    if (pdfInfo && startPage > 0) {
      const timeoutId = setTimeout(() => {
        const pageElement = pageRefs.current.get(startPage);
        if (pageElement && scrollContainerRef.current) {
          pageElement.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }, 100); // Small delay to allow animations to start
      return () => clearTimeout(timeoutId);
    }
  }, [startPage, pdfInfo]);

  // Helper to set page ref
  const setPageRef = useCallback((pageNum: number, element: HTMLDivElement | null) => {
    if (element) {
      pageRefs.current.set(pageNum, element);
    } else {
      pageRefs.current.delete(pageNum);
    }
  }, []);

  return (
    <div className="min-h-screen forest-bg">
      {/* Header */}
      <header className="px-6 py-8 text-center relative z-10">
        <div className="animate-fade-up">
          {/* Decorative leaf */}
          <div className="flex justify-center mb-4">
            <svg
              className="w-8 h-8 leaf-icon animate-leaf"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z" />
            </svg>
          </div>
          <h1
            className="text-3xl md:text-4xl mb-2 text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Page Extractor
          </h1>
          <p className="text-[var(--muted)] text-base">
            Select pages from your PDF with a live preview
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 pb-12 relative z-10">
        {!pdfInfo ? (
          /* Upload State */
          <div className="max-w-xl mx-auto animate-fade-up delay-1" style={{ opacity: 0 }}>
            <div
              className={`drop-zone card p-12 md:p-16 text-center cursor-pointer border-2 border-dashed ${
                isDragging ? "dragging" : "border-[var(--border)]"
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
                  <div className="spinner mx-auto mb-6" />
                  <p className="text-[var(--muted)]">Reading your document...</p>
                </div>
              ) : (
                <>
                  {/* Forest document icon */}
                  <div className="w-20 h-24 mx-auto mb-8 relative">
                    <div className="absolute inset-0 bg-[var(--accent-light)] border-2 border-[var(--accent-muted)] rounded-lg" />
                    <div className="absolute top-0 right-0 w-6 h-6 bg-[var(--background)] border-l-2 border-b-2 border-[var(--accent-muted)] rounded-bl-lg" />
                    <div className="absolute inset-x-3 bottom-4 space-y-2">
                      <div className="h-1.5 bg-[var(--accent-muted)] rounded-full" />
                      <div className="h-1.5 bg-[var(--accent-muted)] rounded-full w-4/5" />
                      <div className="h-1.5 bg-[var(--accent-muted)] rounded-full w-3/5" />
                    </div>
                    {/* Small leaf decoration */}
                    <svg
                      className="absolute -top-2 -right-2 w-5 h-5 text-[var(--accent)] animate-sway"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z" />
                    </svg>
                  </div>

                  <p className="text-lg mb-2 text-[var(--foreground)]">
                    {isDragging ? "Release to upload" : "Drop your PDF here"}
                  </p>
                  <p className="text-[var(--muted)] text-sm">
                    or click to browse your files
                  </p>
                </>
              )}
            </div>

            {error && (
              <div
                className="mt-6 p-4 rounded-xl bg-[var(--error-light)] border border-[var(--error)]/20 animate-fade-in"
                role="alert"
              >
                <p className="text-[var(--error)] text-sm text-center">{error}</p>
              </div>
            )}

            <p className="text-center text-xs text-[var(--muted-light)] mt-10">
              Your files stay private — all processing happens in your browser
            </p>
          </div>
        ) : (
          /* Editor State - Two Column Layout */
          <div
            className="max-w-6xl mx-auto animate-scale-in"
            style={{ opacity: 0 }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: PDF Preview */}
              <div className="preview-panel order-2 lg:order-1">
                <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider">
                    Preview
                  </h2>
                  <span className="text-xs text-[var(--muted-light)]">
                    {pdfInfo.pageCount} pages
                  </span>
                </div>
                <div className="preview-scroll" ref={scrollContainerRef}>
                  <Document
                    file={pdfInfo.url}
                    loading={
                      <div className="flex items-center justify-center py-12">
                        <div className="spinner" />
                      </div>
                    }
                  >
                    <div>
                      {pageNumbers.map((pageNum) => {
                        const visible = isPageVisible(pageNum);
                        const selected = isPageSelected(pageNum);
                        return (
                          <div
                            key={pageNum}
                            ref={(el) => setPageRef(pageNum, el)}
                            className={`page-thumb-wrapper ${
                              visible ? "visible" : "hidden"
                            }`}
                          >
                            <div
                              className={`page-thumb ${visible ? "selected" : ""}`}
                              onClick={() => {
                                setStartPage(pageNum);
                                setEndPage(pageNum);
                              }}
                            >
                              <Page
                                pageNumber={pageNum}
                                width={280}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                              />
                              {visible && (
                                <svg
                                  className="selection-check"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  strokeWidth={3}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              )}
                              <span className="page-number">{pageNum}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Document>
                </div>
              </div>

              {/* Right: Controls */}
              <div className="order-1 lg:order-2 space-y-6">
                {/* File Info Card */}
                <div className="card p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      {/* PDF Icon */}
                      <div className="w-14 h-16 flex-shrink-0 relative">
                        <div className="absolute inset-0 bg-[var(--accent-light)] border border-[var(--accent-muted)] rounded-lg flex items-end justify-center pb-2">
                          <span className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider">
                            PDF
                          </span>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <h2
                          className="font-semibold truncate text-lg"
                          title={pdfInfo.name}
                        >
                          {pdfInfo.name}
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="file-badge">
                            {pdfInfo.pageCount} pages
                          </span>
                          <span className="text-sm text-[var(--muted)]">
                            {pdfInfo.size}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={resetFile}
                      className="p-2 -m-1 text-[var(--muted)] hover:text-[var(--error)] hover:bg-[var(--error-light)] rounded-lg transition-all"
                      aria-label="Remove file"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
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

                {/* Range Selection Card */}
                <div className="card p-6 space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-4">
                      Select Page Range
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-xs text-[var(--muted)] mb-2">
                          From
                        </label>
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
                          className="input text-center text-xl font-semibold"
                          aria-label="Start page"
                        />
                      </div>
                      <div className="pt-6">
                        <svg
                          className="w-6 h-6 text-[var(--accent-muted)]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17 8l4 4m0 0l-4 4m4-4H3"
                          />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-[var(--muted)] mb-2">
                          To
                        </label>
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
                          className="input text-center text-xl font-semibold"
                          aria-label="End page"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quick Select */}
                  <div>
                    <label className="block text-xs text-[var(--muted)] mb-3">
                      Quick select
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setStartPage(1);
                          setEndPage(pdfInfo.pageCount);
                        }}
                        className="btn btn-secondary"
                      >
                        All pages
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
                  </div>

                  {/* Range Display */}
                  <div className="range-display">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-5 h-5 text-[var(--accent)]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <span className="text-sm text-[var(--foreground)]">
                          Pages to extract
                        </span>
                      </div>
                      <span className="font-bold text-[var(--accent)] text-lg">
                        {isValidRange ? (
                          <>
                            {selectedPageCount} page
                            {selectedPageCount !== 1 && "s"}
                          </>
                        ) : (
                          <span className="text-[var(--error)]">Invalid</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {error && (
                    <div
                      className="p-4 rounded-xl bg-[var(--error-light)] border border-[var(--error)]/20 animate-fade-in"
                      role="alert"
                    >
                      <p className="text-[var(--error)] text-sm text-center">
                        {error}
                      </p>
                    </div>
                  )}

                  {/* Download Button */}
                  <button
                    onClick={extractPages}
                    disabled={!isValidRange || isProcessing}
                    className="btn btn-primary w-full text-base"
                  >
                    {isProcessing ? (
                      <>
                        <span className="spinner !w-5 !h-5 !border-white/30 !border-t-white" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-5 h-5"
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
                        Download Extracted PDF
                      </>
                    )}
                  </button>
                </div>

                {/* Privacy Note */}
                <p className="text-center text-xs text-[var(--muted-light)]">
                  All processing happens locally in your browser
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
