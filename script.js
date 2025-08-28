// --- API base 관리 ---
const apiInput = document.getElementById("apiInput");
const saveApiBtn = document.getElementById("saveApiBtn");
const healthDot = document.getElementById("healthDot");

const DEFAULT_API = "http://localhost:8000";
const API_BASE = (localStorage.getItem("API_BASE") || DEFAULT_API).replace(/\/$/, "");
apiInput.value = API_BASE;

async function checkHealth() {
  try {
    const res = await fetch(API_BASE + "/health", { cache: "no-store" });
    healthDot.className = "dot ok";
    return await res.json();
  } catch {
    healthDot.className = "dot bad";
    return null;
  }
}
saveApiBtn.addEventListener("click", async () => {
  const val = apiInput.value.trim().replace(/\/$/, "");
  if (!/^https?:\/\/.+/i.test(val)) {
    showToast("API 주소는 http:// 또는 https:// 로 시작해야 합니다.", "error");
    return;
  }
  localStorage.setItem("API_BASE", val);
  showToast("API 주소 저장됨", "info");
  await checkHealth();
});
checkHealth();

// --- 업로더 / 미리보기 ---
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const predictBtn = document.getElementById("predictBtn");
const spinner = document.getElementById("spinner");
const preview = document.getElementById("preview");
const previewImg = document.getElementById("previewImg");
const fileMeta = document.getElementById("fileMeta");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const summaryEl = document.getElementById("summary");
const toastEl = document.getElementById("toast");

let selectedFile = null;

function showToast(msg, type = "info") {
  toastEl.textContent = msg;
  toastEl.className = "toast " + type;
  setTimeout(() => (toastEl.className = "toast hidden"), 2200);
}
function setBusy(b) {
  if (b) {
    spinner.classList.remove("hidden");
    predictBtn.disabled = true;
    dropzone.setAttribute("aria-busy", "true");
  } else {
    spinner.classList.add("hidden");
    predictBtn.disabled = !selectedFile;
    dropzone.removeAttribute("aria-busy");
  }
}
function setStatus(msg) { statusEl.textContent = msg || ""; }
function resetResults() {
  resultsEl.innerHTML = "";
  summaryEl.textContent = "";
}

function humanSize(bytes) {
  const u = ["B","KB","MB","GB"]; let i = 0;
  while (bytes >= 1024 && i < u.length - 1) { bytes /= 1024; i++; }
  return `${bytes.toFixed(1)} ${u[i]}`;
}
function confidenceBadge(p) {
  if (p >= 0.7) return "high";
  if (p >= 0.4) return "mid";
  return "low";
}

// 미리보기 표시
function onFileSelected(file) {
  if (!file.type.startsWith("image/")) {
    showToast("이미지 파일만 업로드할 수 있습니다.", "error"); return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast("파일이 너무 큽니다 (최대 5MB).", "error"); return;
  }
  selectedFile = file;
  predictBtn.disabled = false;
  resetResults();
  setStatus("");

  const url = URL.createObjectURL(file);
  previewImg.src = url;
  fileMeta.textContent = `${file.name} · ${humanSize(file.size)} · ${file.type}`;
  preview.classList.remove("hidden");
}

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
});
dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("dragover"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault(); dropzone.classList.remove("dragover");
  const file = e.dataTransfer.files?.[0]; if (file) onFileSelected(file);
});
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0]; if (file) onFileSelected(file);
});

// --- 예측 호출 ---
predictBtn.addEventListener("click", predict);
async function predict() {
  if (!selectedFile) return;
  setBusy(true); resetResults(); setStatus("예측 중…");

  const form = new FormData();
  form.append("file", selectedFile, selectedFile.name);

  const t0 = performance.now();
  try {
    const res = await fetch(API_BASE + "/predict", { method: "POST", body: form });
    const elapsed = performance.now() - t0;

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    const data = await res.json();
    renderResults(data);
    const ms = typeof data.inference_time_ms === "number" ? data.inference_time_ms.toFixed(1) : elapsed.toFixed(1);
    setStatus(`처리시간: ${ms} ms · 모델: ${data.model_name || "unknown"}`);
  } catch (e) {
    console.error(e);
    setStatus("");
    showToast("오류: " + e.message, "error");
  } finally {
    setBusy(false);
  }
}

function renderResults(data) {
  const items = data?.topk || [];
  if (!items.length) { resultsEl.textContent = "결과가 없습니다."; return; }

  // 요약: Top-1 라벨 + 확신 배지
  const top1 = items[0];
  summaryEl.innerHTML = `Top-1: <b>${top1.label}</b> 
    <span class="badge ${confidenceBadge(top1.probability)}">${(top1.probability*100).toFixed(1)}%</span>`;

  // 막대(bar) UI
  resultsEl.innerHTML = "";
  items.forEach((it, idx) => {
    const row = document.createElement("div");
    row.className = "row result";

    const label = document.createElement("div");
    label.className = "label";
    label.textContent = `${idx+1}. ${it.label}`;

    const barWrap = document.createElement("div");
    barWrap.className = "bar-wrap";
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.width = Math.max(3, Math.round(it.probability*100)) + "%";
    const pct = document.createElement("div");
    pct.className = "pct";
    pct.textContent = (it.probability*100).toFixed(1) + "%";

    barWrap.appendChild(bar);
    barWrap.appendChild(pct);

    row.appendChild(label);
    row.appendChild(barWrap);
    resultsEl.appendChild(row);
  });
}
