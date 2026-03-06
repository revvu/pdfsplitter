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
  const [selectedFileName, setSelectedFileName] = useState<string>("");
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
    setSelectedFileName(file.name);

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
      setSelectedFileName("");
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
        setSelectedFileName("");
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
    setSelectedFileName("");
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
            block: "nearest",
            inline: "center",
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

  const displayFileName = pdfInfo?.name ?? selectedFileName;

  return (
    <div className="noir-shell">
      <div className="noir-wrap">
        <header className="noir-topbar animate-fade-up">
          <span>PAGE EXTRACTOR</span>
          <span className="client-badge">
            <span className="client-dot" />
            CLIENT-SIDE ONLY
          </span>
        </header>

        <main className="noir-main">
          <section className="hero-block animate-fade-up delay-1">
            <h1 className="hero-title">
              Extract
              <span>with precision.</span>
            </h1>
            <p className="hero-copy">
              Select the pages you need. Everything processed locally. Nothing
              leaves your machine.
            </p>
          </section>

          <section
            className={`upload-panel animate-fade-up delay-2 ${isDragging ? "dragging" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Upload PDF file"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="upload-inner">
              {isProcessing ? (
                <>
                  <div className="spinner mx-auto mb-4" />
                  <p className="upload-title">Preparing preview...</p>
                </>
              ) : (
                <>
                  <svg
                    className="upload-icon"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={1.8}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                    />
                  </svg>
                  <p className="upload-title">
                    {isDragging ? "Release to upload" : "Drop your PDF here"}
                  </p>
                  <p className="upload-copy">or use the button below</p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    CHOOSE FILE
                  </button>
                </>
              )}

              {displayFileName && (
                <p className="upload-meta" title={displayFileName}>
                  {displayFileName}
                </p>
              )}
            </div>
          </section>

          {error && (
            <div className="error-panel animate-fade-in" role="alert">
              {error}
            </div>
          )}

          {pdfInfo && (
            <section className="selection-block animate-scale-in">
              <div className="selection-head">
                <span>PAGE SELECTION</span>
                <span>{pdfInfo.pageCount} pages</span>
              </div>

              <div className="range-controls">
                <label>
                  From
                  <input
                    type="number"
                    min={1}
                    max={pdfInfo.pageCount}
                    value={startPage}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setStartPage(Math.max(1, Math.min(val, pdfInfo.pageCount)));
                    }}
                    className="input"
                    aria-label="Start page"
                  />
                </label>
                <label>
                  To
                  <input
                    type="number"
                    min={1}
                    max={pdfInfo.pageCount}
                    value={endPage}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setEndPage(Math.max(1, Math.min(val, pdfInfo.pageCount)));
                    }}
                    className="input"
                    aria-label="End page"
                  />
                </label>
                <button
                  type="button"
                  className="mini-action"
                  onClick={() => {
                    setStartPage(1);
                    setEndPage(pdfInfo.pageCount);
                  }}
                >
                  All
                </button>
                <button type="button" className="mini-action" onClick={resetFile}>
                  Replace
                </button>
              </div>

              <div className="thumb-scroll" ref={scrollContainerRef}>
                <Document
                  file={pdfInfo.url}
                  loading={
                    <div className="flex items-center justify-center py-8">
                      <div className="spinner" />
                    </div>
                  }
                >
                  <div className="thumb-row">
                    {pageNumbers.map((pageNum) => {
                      const selected = isPageVisible(pageNum);
                      return (
                        <div
                          key={pageNum}
                          ref={(el) => setPageRef(pageNum, el)}
                          className={`thumb-card ${selected ? "selected" : ""}`}
                          onClick={() => {
                            setStartPage(pageNum);
                            setEndPage(pageNum);
                          }}
                        >
                          <div className="thumb-check" aria-hidden={!selected}>
                            {selected ? "✓" : ""}
                          </div>
                          <Page
                            pageNumber={pageNum}
                            width={116}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                          />
                          <span className="thumb-index">
                            {pageNum.toString().padStart(2, "0")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Document>
              </div>

              <div className="action-bar">
                <div className="action-meta">
                  {isValidRange ? (
                    <>
                      {selectedPageCount} page{selectedPageCount !== 1 && "s"} selected
                    </>
                  ) : (
                    "Invalid range"
                  )}{" "}
                  · ready to extract
                </div>
                <button
                  onClick={extractPages}
                  disabled={!isValidRange || isProcessing}
                  className="btn btn-primary extract-btn"
                >
                  {isProcessing ? "EXTRACTING..." : "EXTRACT PAGES"}
                </button>
              </div>
            </section>
          )}
        </main>

        <footer className="noir-footer">
          ALL PROCESSING HAPPENS IN YOUR BROWSER · ZERO DATA TRANSMITTED
        </footer>
      </div>
    </div>
  );
}
