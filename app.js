// ============================================================
// Survey Controller
// Loads config, picks N random pairs, renders questions,
// supports Prev/Next navigation with answer caching,
// per-iframe zoom controls, and submits all responses at the end.
// ============================================================

let CONFIG = null;
let SELECTED_PAIRS = [];
let CURRENT_INDEX = 0;
let PAIR_START_TIMES = [];
let PAIR_TIME_SPENT = [];
let CACHED_ANSWERS = [];
let SUBMITTING = false;

const PID = sessionStorage.getItem("PROLIFIC_PID") || "UNKNOWN";
const SID = sessionStorage.getItem("STUDY_ID") || "UNKNOWN";
const SSN = sessionStorage.getItem("SESSION_ID") || "UNKNOWN";

// Zoom state per iframe (defaults to 80%)
const ZOOM_STATE = { about: 0.8, product: 0.8 };
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.1;

// ---------- Init ----------

async function init() {
  try {
    const res = await fetch("config.json");
    CONFIG = await res.json();
  } catch (e) {
    alert("Failed to load study config. Please refresh.");
    console.error(e);
    return;
  }

  SELECTED_PAIRS = pickRandomPairs(CONFIG.pairs, CONFIG.pairs_per_participant);
  CACHED_ANSWERS = SELECTED_PAIRS.map(() => null);
  PAIR_START_TIMES = SELECTED_PAIRS.map(() => null);
  PAIR_TIME_SPENT = SELECTED_PAIRS.map(() => 0);

  document.getElementById("total-pairs").textContent = SELECTED_PAIRS.length;

  document.getElementById("questions-form").addEventListener("submit", onNext);
  document.getElementById("prev-btn").addEventListener("click", onPrev);

  setupZoomControls();
  renderCurrentPair();
}

function pickRandomPairs(pairs, n) {
  const shuffled = [...pairs];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}

// ---------- Zoom ----------

function setupZoomControls() {
  document.querySelectorAll(".stim-panel").forEach(panel => {
    const which = panel.dataset.frame;  // "about" or "product"
    panel.querySelectorAll(".zoom-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        if (action === "in")        ZOOM_STATE[which] = Math.min(ZOOM_MAX, ZOOM_STATE[which] + ZOOM_STEP);
        else if (action === "out")  ZOOM_STATE[which] = Math.max(ZOOM_MIN, ZOOM_STATE[which] - ZOOM_STEP);
        else if (action === "reset") ZOOM_STATE[which] = 0.8;
        applyZoom(which);
      });
    });
  });
  applyZoom("about");
  applyZoom("product");
}

function applyZoom(which) {
  const scale = ZOOM_STATE[which];
  const panel = document.querySelector(`.stim-panel[data-frame="${which}"]`);
  if (!panel) return;
  const iframe = panel.querySelector("iframe");
  const levelEl = panel.querySelector(".zoom-level");
  if (iframe) {
    iframe.style.transform = `scale(${scale})`;
    // Inverse-size the iframe so it still fills the wrapper after scaling
    const inverse = (100 / scale) + "%";
    iframe.style.width = inverse;
    iframe.style.height = inverse;
  }
  if (levelEl) levelEl.textContent = Math.round(scale * 100) + "%";
}

// ---------- Rendering ----------

function renderCurrentPair() {
  const pair = SELECTED_PAIRS[CURRENT_INDEX];
  PAIR_START_TIMES[CURRENT_INDEX] = Date.now();

  document.getElementById("current-pair").textContent = CURRENT_INDEX + 1;
  const pct = (CURRENT_INDEX / SELECTED_PAIRS.length) * 100;
  document.getElementById("progress-fill").style.width = pct + "%";

  document.getElementById("about-frame").src = pair.about_html;
  document.getElementById("product-frame").src = pair.product_html;

  renderQuestions();
  restoreCachedAnswers();
  updateNavButtons();
}

function renderQuestions() {
  const container = document.getElementById("questions-container");
  container.innerHTML = "";

  CONFIG.questions.forEach((q, idx) => {
    const block = document.createElement("div");
    block.className = "question-block";
    block.dataset.qid = q.id;
    block.dataset.qtype = q.type;

    const label = document.createElement("div");
    label.className = "question-label";
    label.innerHTML = `<span class="qnum">${idx + 1}.</span> ${q.text}${q.optional ? '' : ' <span class="required">*</span>'}`;
    block.appendChild(label);

    if (q.type === "single") {
      const list = document.createElement("div");
      list.className = "radio-list";
      q.options.forEach(opt => {
        const row = document.createElement("label");
        row.className = "radio-row";
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = q.id;
        radio.value = opt;
        radio.required = !q.optional;
        row.appendChild(radio);
        const txt = document.createElement("span");
        txt.textContent = opt;
        row.appendChild(txt);
        list.appendChild(row);
      });
      block.appendChild(list);
    }
    else if (q.type === "multi") {
      const list = document.createElement("div");
      list.className = "checkbox-list";
      q.options.forEach(opt => {
        const row = document.createElement("label");
        row.className = "checkbox-row";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.name = q.id;
        cb.value = opt;
        row.appendChild(cb);
        const txt = document.createElement("span");
        txt.textContent = opt;
        row.appendChild(txt);
        list.appendChild(row);
      });
      if (q.allow_other) {
        const otherRow = document.createElement("label");
        otherRow.className = "checkbox-row other-row";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.name = q.id;
        cb.value = "__OTHER__";
        otherRow.appendChild(cb);
        const txt = document.createElement("span");
        txt.textContent = "Other:";
        otherRow.appendChild(txt);
        const input = document.createElement("input");
        input.type = "text";
        input.className = "other-input";
        input.name = q.id + "__other_text";
        input.placeholder = "specify";
        input.disabled = true;
        otherRow.appendChild(input);
        list.appendChild(otherRow);

        cb.addEventListener("change", () => {
          input.disabled = !cb.checked;
          if (!cb.checked) input.value = "";
        });
      }
      block.appendChild(list);
    }
    else if (q.type === "text") {
      const inp = document.createElement("input");
      inp.type = "text";
      inp.name = q.id;
      inp.className = "text-input";
      inp.placeholder = q.placeholder || "";
      inp.required = !q.optional;
      block.appendChild(inp);
    }

    container.appendChild(block);
  });
}

function updateNavButtons() {
  document.getElementById("prev-btn").disabled = (CURRENT_INDEX === 0);
  const isLast = CURRENT_INDEX === SELECTED_PAIRS.length - 1;
  document.getElementById("submit-btn").textContent = isLast ? "Submit study →" : "Next pair →";
}

// ---------- Answer caching ----------

function captureRawAnswers() {
  const raw = {};
  CONFIG.questions.forEach(q => {
    if (q.type === "single") {
      const el = document.querySelector(`input[type="radio"][name="${q.id}"]:checked`);
      raw[q.id] = el ? el.value : "";
    }
    else if (q.type === "multi") {
      const checked = Array.from(
        document.querySelectorAll(`input[type="checkbox"][name="${q.id}"]:checked`)
      ).map(c => c.value);
      const otherEl = document.querySelector(`input[name="${q.id}__other_text"]`);
      raw[q.id] = {
        checked: checked,
        other_text: otherEl ? otherEl.value : ""
      };
    }
    else if (q.type === "text") {
      const el = document.querySelector(`input[name="${q.id}"]`);
      raw[q.id] = el ? el.value : "";
    }
  });
  return raw;
}

function restoreCachedAnswers() {
  const cached = CACHED_ANSWERS[CURRENT_INDEX];
  if (!cached) return;

  CONFIG.questions.forEach(q => {
    const val = cached[q.id];
    if (val == null) return;

    if (q.type === "single") {
      if (val) {
        const radio = document.querySelector(`input[type="radio"][name="${q.id}"][value="${cssEscape(val)}"]`);
        if (radio) radio.checked = true;
      }
    }
    else if (q.type === "multi") {
      const checked = val.checked || [];
      checked.forEach(v => {
        const cb = document.querySelector(`input[type="checkbox"][name="${q.id}"][value="${cssEscape(v)}"]`);
        if (cb) cb.checked = true;
      });
      if (checked.includes("__OTHER__")) {
        const otherEl = document.querySelector(`input[name="${q.id}__other_text"]`);
        if (otherEl) {
          otherEl.disabled = false;
          otherEl.value = val.other_text || "";
        }
      }
    }
    else if (q.type === "text") {
      const el = document.querySelector(`input[name="${q.id}"]`);
      if (el) el.value = val;
    }
  });
}

function cssEscape(str) {
  return String(str).replace(/(["\\])/g, "\\$1");
}

// ---------- Validation & submission ----------

function validateResponses() {
  for (const q of CONFIG.questions) {
    if (q.optional) continue;
    if (q.type === "single") {
      const sel = document.querySelector(`input[type="radio"][name="${q.id}"]:checked`);
      if (!sel) return q;
    }
    else if (q.type === "multi") {
      const checked = document.querySelectorAll(`input[type="checkbox"][name="${q.id}"]:checked`);
      if (checked.length === 0) return q;
      const otherCb = document.querySelector(`input[type="checkbox"][name="${q.id}"][value="__OTHER__"]`);
      if (otherCb && otherCb.checked) {
        const ot = document.querySelector(`input[name="${q.id}__other_text"]`);
        if (!ot.value.trim()) return q;
      }
    }
    else if (q.type === "text") {
      const v = document.querySelector(`input[name="${q.id}"]`).value.trim();
      if (!v) return q;
    }
  }
  return null;
}

function buildSubmissionRecord(pairIndex) {
  const pair = SELECTED_PAIRS[pairIndex];
  const raw = CACHED_ANSWERS[pairIndex];
  const answers = {};
  CONFIG.questions.forEach(q => {
    const val = raw[q.id];
    if (q.type === "multi") {
      let checked = [...(val.checked || [])];
      if (checked.includes("__OTHER__")) {
        const idx = checked.indexOf("__OTHER__");
        const ot = (val.other_text || "").trim();
        checked[idx] = ot ? `Other: ${ot}` : "Other";
      }
      answers[q.id] = checked.join(" | ");
    } else {
      answers[q.id] = (val || "").toString().trim();
    }
  });

  return {
    prolific_pid: PID,
    study_id: SID,
    session_id: SSN,
    pair_index: pairIndex + 1,
    pair_id: pair.pair_id,
    product_id: pair.product_id,
    about_id: pair.about_id,
    source_product_url: pair.source_product_url,
    source_about_url: pair.source_about_url,
    time_on_pair_seconds: PAIR_TIME_SPENT[pairIndex],
    timestamp_iso: new Date().toISOString(),
    ...answers
  };
}

// ---------- Navigation handlers ----------

function accumulateTime() {
  const start = PAIR_START_TIMES[CURRENT_INDEX];
  if (start) {
    PAIR_TIME_SPENT[CURRENT_INDEX] += Math.round((Date.now() - start) / 1000);
  }
}

function onPrev() {
  CACHED_ANSWERS[CURRENT_INDEX] = captureRawAnswers();
  accumulateTime();
  CURRENT_INDEX--;
  renderCurrentPair();
}

async function onNext(e) {
  e.preventDefault();
  if (SUBMITTING) return;

  const missing = validateResponses();
  if (missing) {
    alert(`Please answer question: "${missing.text.replace(/\s+/g, ' ')}"`);
    const el = document.querySelector(`[data-qid="${missing.id}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  CACHED_ANSWERS[CURRENT_INDEX] = captureRawAnswers();
  accumulateTime();

  const isLast = CURRENT_INDEX === SELECTED_PAIRS.length - 1;

  if (!isLast) {
    CURRENT_INDEX++;
    renderCurrentPair();
    return;
  }

  SUBMITTING = true;
  const btn = document.getElementById("submit-btn");
  const prevBtn = document.getElementById("prev-btn");
  btn.disabled = true; prevBtn.disabled = true;
  btn.textContent = "Submitting…";

  try {
    const records = SELECTED_PAIRS.map((_, i) => buildSubmissionRecord(i));
    await submitAll(records);
    window.location.href = "thanks.html";
  } catch (err) {
    SUBMITTING = false;
    btn.disabled = false; prevBtn.disabled = false;
    btn.textContent = "Submit study →";
    alert("Submission failed: " + err.message + "\nPlease try again.");
  }
}

async function submitAll(records) {
  const endpoint = CONFIG.sheets_endpoint || "/submit";
  if (endpoint.startsWith("REPLACE")) {
    console.warn("No endpoint configured — records:", records);
    return;
  }
  for (const record of records) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record)
    });
    if (!res.ok) {
      throw new Error(`Server returned ${res.status} for pair ${record.pair_index}`);
    }
  }
}

// Boot
init();
