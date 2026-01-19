const MODEL_BASE = "sirasagi62/ruri-v3-30m-ONNX";
const VECTORS_JSON = "/vectors.json";

// --- 数学ユーティリティ ---
function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
function norm(a) {
  return Math.sqrt(dot(a, a));
}
function normalize(a) {
  const n = norm(a) || 1e-12;
  return a.map(x => x / n);
}

// --- ベクトル読み込み ---
let VECTORS = null;
async function loadVectors() {
  if (VECTORS) return VECTORS;
  setStatus("vectors.json を読み込み中...");
  const res = await fetch(VECTORS_JSON);
  if (!res.ok) throw new Error("vectors.json の読み込みに失敗しました: " + res.status);
  const arr = await res.json();
  for (const e of arr) {
    if (!e.vector) throw new Error("vectors.json の各要素に vector が必要です");
    e._vec_norm = normalize(e.vector);
    e.meta = e.metadata ?? {}; // metadata → meta に変換
  }
  VECTORS = arr;
  setStatus(`vectors.json 読み込み完了 (${VECTORS.length} 件)`);
  return VECTORS;
}

// --- transformers.js の pipeline を準備（CDN + ruri） ---
let featurePipeline = null;
async function ensureFeaturePipeline() {
  if (featurePipeline) return featurePipeline;
  setStatus("transformers をロード中...");
  const transformers = await import("https://cdn.jsdelivr.net/npm/@xenova/transformers");
  console.log("transformers exports:", Object.keys(transformers));
  featurePipeline = await transformers.pipeline("feature-extraction", MODEL_BASE);
  setStatus("feature-extraction pipeline 準備完了");
  return featurePipeline;
}

// --- クエリ埋め込み生成（pipeline のみ対応）---
async function createQueryEmbedding(text) {
  const p = await ensureFeaturePipeline();
  
  // pooling: "mean" で文ベクトルを作成し、normalize: true で正規化まで完了させる
  const out = await p(text, { pooling: 'mean', normalize: true });

  // 戻り値は Tensor オブジェクトなので、.data (Float32Array) を取り出して Array に変換
  return Array.from(out.data);
}

// --- 線形スキャン検索 ---
function bruteForceSearch(vectors, qVec, k = 10) {
  const qn = normalize(qVec);
  const scores = vectors.map(e => ({
    id: e.id,
    score: dot(qn, e._vec_norm),
    meta: e.meta ?? {}
  }));
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, k);
}

// --- UI ヘルパー ---
function setStatus(s) {
  const el = document.getElementById("status");
  if (el) el.textContent = s;
}
function renderResults(results) {
  const root = document.getElementById("results");
  root.innerHTML = "";
  if (!results.length) {
    root.textContent = "結果なし";
    return;
  }
  for (const r of results) {
    const meta = r.meta ?? {};
    const title = escapeHtml(meta.title ?? r.id);
    const performer = escapeHtml(meta.performer ?? "");
    const lyricist = escapeHtml(meta.lyricist ?? "");
    const composer = escapeHtml(meta.composer ?? "");
    const score = r.score.toFixed(4);

    let youtubeHtml = "";
    if (meta.ytId) {
      const ytId = escapeHtml(meta.ytId);
      const thumbUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
      youtubeHtml = `
        <div class="yt-thumb" data-ytid="${ytId}" style="cursor:pointer;">
          <img src="${thumbUrl}" alt="YouTube Thumbnail" style="width:100%;max-width:480px;border-radius:8px;margin-top:0.5em;">
        </div>`;
    }

    const div = document.createElement("div");
    div.className = "item";
div.innerHTML = `
  <div style="display: flex; gap: 1em; align-items: flex-start;">
    ${youtubeHtml ? `
      <div style="flex-shrink: 0; width: 160px;">
        ${youtubeHtml}
      </div>` : ''
    }
    <div style="flex: 1;">
      <div>
        <strong>${title}</strong>
        <span class="score">${score}</span>
      </div>
      <div style="color:#444;font-size:0.9em">
        ${performer}<br>
        作詞: ${lyricist} / 作曲: ${composer}
      </div>
    </div>
  </div>
`;

    root.appendChild(div);
  }

  // サムネイルクリックでプレイヤー表示
  document.querySelectorAll(".yt-thumb").forEach(el => {
    el.addEventListener("click", () => {
      const ytId = el.getAttribute("data-ytid");
      const iframe = document.getElementById("ytPlayer");
      iframe.src = `https://www.youtube.com/embed/${ytId}?autoplay=1`;
      document.getElementById("playerModal").style.display = "flex";
    });
  });
}

// プレイヤーを閉じる処理
document.getElementById("closePlayer").addEventListener("click", () => {
  const iframe = document.getElementById("ytPlayer");
  iframe.src = ""; // 再生停止
  document.getElementById("playerModal").style.display = "none";
});


function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// --- ボタン処理 ---
document.getElementById("searchBtn").addEventListener("click", async () => {
  try {
    const q = document.getElementById("query").value.trim();
    if (!q) return;
    setStatus("検索処理中...");
    await loadVectors();
    const qVec = await createQueryEmbedding(q);
    const results = bruteForceSearch(VECTORS, qVec, 10);
    renderResults(results);
    setStatus("完了");
  } catch (err) {
    console.error(err);
    setStatus("エラー: " + (err.message || err));
  }
});