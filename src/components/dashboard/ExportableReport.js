"use client";

import { useRef, useState } from "react";
import MaterialSymbol from "@/components/MaterialSymbol";

function sanitizeFilename(value = "matchmake-report") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "matchmake-report";
}

async function waitForReportAssets(node) {
  if (document.fonts?.ready) {
    await document.fonts.ready.catch(() => {});
  }

  const images = Array.from(node.querySelectorAll("img"));
  await Promise.all(images.map(async (image) => {
    if (!image.complete) {
      await new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
      });
    }
    if (typeof image.decode === "function") {
      await image.decode().catch(() => {});
    }
  }));
}

function applyExportOverrides(clone) {
  clone.querySelectorAll("[data-export-ignore='true']").forEach((node) => node.remove());
  clone.querySelectorAll("[data-export-reveal='true']").forEach((node) => {
    node.classList.remove("hidden");
    node.style.display = "block";
  });
  clone.querySelectorAll("[data-export-columns]").forEach((node) => {
    const columns = Number(node.getAttribute("data-export-columns"));
    if (!Number.isFinite(columns) || columns < 1) return;
    node.style.display = "grid";
    node.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
  });
}

function mountExportClone(clone, reportWidth) {
  clone.setAttribute("aria-hidden", "true");
  clone.setAttribute("data-export-copy", "true");
  Object.assign(clone.style, {
    left: "0",
    maxWidth: "none",
    pointerEvents: "none",
    position: "fixed",
    top: "0",
    width: `${reportWidth}px`,
    zIndex: "-2147483647",
  });

  applyExportOverrides(clone);
  document.body.appendChild(clone);
  return clone;
}

function createExportClone(reportNode) {
  const reportWidth = Math.max(1080, Math.ceil(reportNode.getBoundingClientRect().width));
  return mountExportClone(reportNode.cloneNode(true), reportWidth);
}

function createExportPageClone(reportNode, pageNode, pageIndex, pageCount) {
  const reportWidth = Math.max(1080, Math.ceil(reportNode.getBoundingClientRect().width));
  const clone = document.createElement("div");
  clone.className = `${reportNode.className} grid gap-lg bg-surface-container-lowest`;

  const reportHeader = Array.from(reportNode.children).find((child) => child.tagName === "HEADER");
  if (reportHeader) clone.appendChild(reportHeader.cloneNode(true));

  const pageTitle = pageNode.getAttribute("data-export-page-title") || `Report page ${pageIndex + 1}`;
  const pageHeader = document.createElement("header");
  pageHeader.className = "flex items-center justify-between gap-md border-b border-outline-variant/25 pb-md";
  const pageTitleWrap = document.createElement("div");
  const pageLabel = document.createElement("p");
  pageLabel.className = "font-label-bold text-label-bold uppercase tracking-wider text-primary";
  pageLabel.textContent = `Page ${String(pageIndex + 1).padStart(2, "0")}`;
  const pageHeading = document.createElement("h2");
  pageHeading.className = "mt-xs font-headline-2 text-headline-2 text-on-surface";
  pageHeading.textContent = pageTitle;
  pageTitleWrap.append(pageLabel, pageHeading);
  const pageCountLabel = document.createElement("p");
  pageCountLabel.className = "font-label-bold text-label-bold text-on-surface-variant";
  pageCountLabel.textContent = `${pageIndex + 1} / ${pageCount}`;
  pageHeader.append(pageTitleWrap, pageCountLabel);
  clone.appendChild(pageHeader);

  const pageContent = pageNode.cloneNode(true);
  pageContent.classList.remove("hidden");
  pageContent.style.display = "block";
  clone.appendChild(pageContent);

  const footer = document.createElement("footer");
  footer.className = "border-t border-outline-variant/25 pt-sm text-right font-label-small text-label-small text-on-surface-variant";
  footer.textContent = `Matchmake report · ${pageIndex + 1} of ${pageCount}`;
  clone.appendChild(footer);

  return mountExportClone(clone, reportWidth);
}

function triggerDownload(href, downloadName) {
  const downloadLink = document.createElement("a");
  downloadLink.download = downloadName;
  downloadLink.href = href;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
}

function getPngOptions(reportNode, pixelRatio) {
  return {
    backgroundColor: window.getComputedStyle(reportNode).backgroundColor || "#ffffff",
    cacheBust: true,
    pixelRatio,
  };
}

export default function ExportableReport({
  buttonLabel = "Export PNG",
  children,
  className = "",
  exportMode = "single",
  filename = "matchmake-report",
  reportClassName = "",
  reportSubtitle = "",
  reportTitle = "",
}) {
  const reportRef = useRef(null);
  const [exportState, setExportState] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [exportProgress, setExportProgress] = useState(null);

  async function handleExport() {
    const visibleReportNode = reportRef.current;
    if (!visibleReportNode || exportState === "exporting") return;

    setExportState("exporting");
    setErrorMessage("");
    setExportProgress(null);

    try {
      const [{ toPng }] = await Promise.all([import("html-to-image")]);
      const dateStamp = new Date().toISOString().slice(0, 10);

      if (exportMode === "pack") {
        const pageNodes = Array.from(visibleReportNode.querySelectorAll("[data-export-page]"));
        if (!pageNodes.length) {
          throw new Error("No report pack pages were found.");
        }

        const { default: JSZip } = await import("jszip");
        const zip = new JSZip();
        const pixelRatio = Math.min(1.75, Math.max(1.5, window.devicePixelRatio || 1));

        for (let pageIndex = 0; pageIndex < pageNodes.length; pageIndex += 1) {
          setExportProgress({ current: pageIndex + 1, total: pageNodes.length });
          const pageNode = pageNodes[pageIndex];
          const pageTitle = pageNode.getAttribute("data-export-page-title") || `page-${pageIndex + 1}`;
          const reportPage = createExportPageClone(visibleReportNode, pageNode, pageIndex, pageNodes.length);
          try {
            await waitForReportAssets(reportPage);
            const dataUrl = await toPng(reportPage, getPngOptions(reportPage, pixelRatio));
            const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
            const pageNumber = String(pageIndex + 1).padStart(2, "0");
            zip.file(`${pageNumber}-${sanitizeFilename(pageTitle)}.png`, base64, { base64: true });
          } finally {
            reportPage.remove();
          }
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const zipUrl = URL.createObjectURL(zipBlob);
        triggerDownload(zipUrl, `${sanitizeFilename(filename)}-${dateStamp}-png-report-pack.zip`);
        window.setTimeout(() => URL.revokeObjectURL(zipUrl), 1000);
      } else {
        const reportNode = createExportClone(visibleReportNode);
        try {
          await waitForReportAssets(reportNode);
          const pixelRatio = Math.min(2, Math.max(1.5, window.devicePixelRatio || 1));
          const dataUrl = await toPng(reportNode, getPngOptions(reportNode, pixelRatio));
          triggerDownload(dataUrl, `${sanitizeFilename(filename)}-${dateStamp}.png`);
        } finally {
          reportNode.remove();
        }
      }

      setExportState("complete");
    } catch (error) {
      console.error("Failed to export report", error);
      setErrorMessage(
        exportMode === "pack"
          ? "Report pack export failed. Check that every report image has loaded, then try again."
          : "PNG export failed. Check that every report image has loaded, then try again."
      );
      setExportState("error");
    } finally {
      setExportProgress(null);
    }
  }

  const buttonText = exportState === "exporting"
    ? exportProgress
      ? `Creating page ${exportProgress.current} of ${exportProgress.total}...`
      : exportMode === "pack"
        ? "Preparing report pack..."
        : "Creating PNG..."
    : exportState === "complete"
      ? exportMode === "pack"
        ? "Report pack downloaded"
        : "PNG downloaded"
      : buttonLabel;

  return (
    <section className={`grid gap-sm ${className}`}>
      <div className="flex flex-wrap items-center justify-end gap-sm" data-export-ignore="true">
        {errorMessage && (
          <p className="font-label-small text-label-small text-error" role="alert">{errorMessage}</p>
        )}
        <button
          className="inline-flex min-h-10 items-center justify-center gap-xs rounded-xl border border-primary/20 bg-primary px-md py-sm font-label-bold text-label-bold text-on-primary shadow-[0_4px_14px_rgba(0,88,188,0.18)] transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-wait disabled:opacity-70"
          disabled={exportState === "exporting"}
          onClick={handleExport}
          type="button"
        >
          <MaterialSymbol className="text-[18px]">
            {exportState === "complete" ? "check_circle" : exportMode === "pack" ? "folder_zip" : "download"}
          </MaterialSymbol>
          {buttonText}
        </button>
      </div>
      <div
        className={`bg-surface-container-lowest ${reportClassName}`}
        data-export-report="true"
        ref={reportRef}
      >
        {reportTitle && (
          <header className="mb-lg border-b border-outline-variant/25 pb-md">
            <p className="font-label-bold text-label-bold uppercase tracking-wider text-outline">Matchmake report</p>
            <h2 className="mt-xs font-headline-1 text-headline-1 text-on-surface">{reportTitle}</h2>
            {reportSubtitle && (
              <p className="mt-xs font-body-sub text-body-sub text-on-surface-variant">{reportSubtitle}</p>
            )}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}
