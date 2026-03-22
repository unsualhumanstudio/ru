(() => {
  const RU_PORT = 27125;

  const TYPES = [
    { id: "note",     color: "#d8b4fe", label: "Note" },
    { id: "question", color: "#a5f3fc", label: "Question" },
    { id: "idea",     color: "#fda4af", label: "Idea" },
    { id: "copy",     color: "#fde68a", label: "Copy" },
    { id: "task",     color: "#bbf7d0", label: "Task" },
  ];

  const CSS = `
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .toolbar {
      position: fixed;
      z-index: 2147483647;
      background: #1a1a1a;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.22), 0 1px 4px rgba(0,0,0,0.14);
      display: flex;
      align-items: center;
      padding: 6px 8px;
      gap: 4px;
      user-select: none;
      animation: ru-in 0.12s ease;
    }

    @keyframes ru-in {
      from { opacity: 0; transform: translateX(-50%) translateY(4px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    .color-btn {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      padding: 0;
      position: relative;
      flex-shrink: 0;
      transition: transform 0.1s;
    }
    .color-btn:hover { transform: scale(1.18); }

    .tooltip {
      position: absolute;
      bottom: calc(100% + 6px);
      left: 50%;
      transform: translateX(-50%);
      background: #000;
      color: #fff;
      font-size: 10px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      padding: 3px 7px;
      border-radius: 5px;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.12s;
    }
    .color-btn:hover .tooltip { opacity: 1; }

    .divider {
      width: 1px;
      height: 16px;
      background: #2e2e2e;
      margin: 0 2px;
      flex-shrink: 0;
    }

    .type-pill {
      font-size: 10px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-weight: 500;
      padding: 2px 8px;
      border-radius: 10px;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .hash {
      color: #555;
      font-size: 12px;
      font-family: "SF Mono", "Fira Code", monospace;
      flex-shrink: 0;
    }

    .tag-input {
      background: transparent;
      border: none;
      outline: none;
      color: #fff;
      font-size: 12px;
      font-family: "SF Mono", "Fira Code", monospace;
      width: 120px;
      caret-color: #aaa;
    }
    .tag-input::placeholder { color: #444; }

    .note-input {
      background: transparent;
      border: none;
      outline: none;
      color: #999;
      font-size: 11px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      width: 90px;
      caret-color: #888;
    }
    .note-input::placeholder { color: #3a3a3a; }

    .save-btn {
      background: #fff;
      color: #111;
      border: none;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      padding: 3px 10px;
      cursor: pointer;
      flex-shrink: 0;
      transition: opacity 0.1s;
    }
    .save-btn:hover { opacity: 0.8; }
    .save-btn:disabled { opacity: 0.3; cursor: default; }

    .status {
      font-size: 11px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      padding: 0 4px;
      white-space: nowrap;
    }
    .status.success { color: #7ee787; }
    .status.error   { color: #f87171; }
  `;

  let host = null;
  let shadow = null;
  let toolbar = null;
  let dropdown = null;
  let savedRange = null;
  let savedText = "";
  let savedUrl = "";
  let activeType = null;
  let allTags = [];
  let suppressMouseup = false;
  let suppressMousedown = false;
  let highlightSpan = null;
  let highlightSheet = null;

  // ── Highlight ─────────────────────────────────────────────────────────────────

  function applyHighlight(range, color) {
    // Primary: CSS Custom Highlight API + adoptedStyleSheets (CSP-safe, no DOM mutation)
    if (typeof CSS !== "undefined" && CSS.highlights) {
      try {
        CSS.highlights.delete("ru-highlight");
        CSS.highlights.set("ru-highlight", new Highlight(range));
        if (!highlightSheet) {
          highlightSheet = new CSSStyleSheet();
          document.adoptedStyleSheets = [...document.adoptedStyleSheets, highlightSheet];
        }
        if (highlightSheet.cssRules.length) highlightSheet.deleteRule(0);
        highlightSheet.insertRule(`::highlight(ru-highlight) { background-color: ${color}; }`);
        return { _pseudo: true };
      } catch { /* fall through */ }
    }
    // Fallback: positioned overlay divs (no DOM mutation, works across element boundaries)
    const rects = Array.from(range.getClientRects()).filter(r => r.width > 0);
    if (!rects.length) return null;
    const overlays = rects.map(r => {
      const div = document.createElement("div");
      div.style.cssText = `position:fixed;top:${r.top}px;left:${r.left}px;width:${r.width}px;height:${r.height}px;background:${color};pointer-events:none;z-index:2147483646;border-radius:2px;mix-blend-mode:multiply;`;
      document.body.appendChild(div);
      return div;
    });
    return { _overlays: overlays };
  }

  function removeHighlight() {
    if (highlightSpan?._pseudo) {
      if (typeof CSS !== "undefined" && CSS.highlights) CSS.highlights.delete("ru-highlight");
      try { if (highlightSheet?.cssRules.length) highlightSheet.deleteRule(0); } catch {}
    } else if (highlightSpan?._overlays) {
      highlightSpan._overlays.forEach(div => div.remove());
    } else if (highlightSpan?.parentNode) {
      const parent = highlightSpan.parentNode;
      while (highlightSpan.firstChild) parent.insertBefore(highlightSpan.firstChild, highlightSpan);
      parent.removeChild(highlightSpan);
      parent.normalize();
    }
    highlightSpan = null;
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  function removeToolbar() {
    if (host) { host.remove(); host = null; shadow = null; toolbar = null; }
    removeDropdown();
    removeHighlight();
  }

  function removeDropdown() {
    if (dropdown) { dropdown.remove(); dropdown = null; }
  }

  // ── Selection ─────────────────────────────────────────────────────────────────

  function captureSelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    const text = sel.toString().trim();
    if (!text) return false;
    savedRange = sel.getRangeAt(0).cloneRange();
    savedText = text;
    savedUrl = window.location.href;
    return true;
  }

  // ── Bridge fetch (routes through background to bypass page CSP) ───────────────

  function bridgeFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
      const nobridge = msg => reject(Object.assign(new Error(msg), { _nobridge: true }));
      try {
        chrome.runtime.sendMessage({ type: "BRIDGE_FETCH", url, options }, res => {
          if (chrome.runtime.lastError) return nobridge(chrome.runtime.lastError.message);
          if (!res) return nobridge("No response from background");
          resolve(res);
        });
      } catch (e) {
        nobridge(e.message);
      }
    });
  }

  // ── Tags ──────────────────────────────────────────────────────────────────────

  async function fetchTags() {
    const [bridgeRes, { savedTags = [] }] = await Promise.all([
      bridgeFetch(`http://localhost:${RU_PORT}/tags`).catch(() => null),
      chrome.storage.local.get("savedTags"),
    ]);
    const bridgeTags = bridgeRes?.ok ? (JSON.parse(bridgeRes.text).tags ?? []) : [];
    allTags = [...new Set([...bridgeTags, ...savedTags])].sort();
  }

  function filterTags(q) {
    if (!q) return allTags.slice(0, 8);
    return allTags.filter(t => t.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  }

  // ── Dropdown (appended to document body, not shadow) ──────────────────────────

  function showDropdown(anchorEl, query, onSelect) {
    removeDropdown();
    const matches = filterTags(query);
    if (!matches.length && !query) return;

    dropdown = document.createElement("div");
    const rect = anchorEl.getBoundingClientRect();
    Object.assign(dropdown.style, {
      position: "fixed",
      top: (rect.bottom + 4) + "px",
      left: rect.left + "px",
      zIndex: "2147483647",
      background: "#1a1a1a",
      border: "1px solid #2a2a2a",
      borderRadius: "8px",
      boxShadow: "0 4px 16px rgba(0,0,0,0.28)",
      overflow: "hidden",
      minWidth: "150px",
      fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
    });

    const addItem = (text, isCreate, tag) => {
      const item = document.createElement("div");
      Object.assign(item.style, {
        padding: "7px 12px",
        fontSize: isCreate ? "11px" : "12px",
        fontFamily: isCreate ? "-apple-system, sans-serif" : "'SF Mono','Fira Code',monospace",
        color: isCreate ? "#888" : "#ccc",
        cursor: "pointer",
        whiteSpace: "nowrap",
      });
      if (isCreate) {
        item.innerHTML = `Create <span style="color:#fff;font-family:'SF Mono',monospace">#${text}</span>`;
      } else {
        item.textContent = text;
      }
      item.addEventListener("mouseover", () => { item.style.background = "#2a2a2a"; item.style.color = "#fff"; });
      item.addEventListener("mouseout",  () => { item.style.background = ""; item.style.color = isCreate ? "#888" : "#ccc"; });
      item.addEventListener("mousedown", e => {
        e.preventDefault();
        suppressMousedown = true;
        suppressMouseup = true;
        setTimeout(() => { suppressMousedown = false; suppressMouseup = false; }, 300);
        onSelect(tag ?? text);
      });
      dropdown.appendChild(item);
    };

    matches.forEach(t => addItem(t, false));
    if (query && !allTags.includes(query)) addItem(query, true, query);

    document.body.appendChild(dropdown);
  }

  // ── Toolbar ───────────────────────────────────────────────────────────────────

  function buildToolbar(rect) {
    removeToolbar();

    host = document.createElement("div");
    host.style.cssText = "all:unset;position:fixed;top:0;left:0;pointer-events:none;z-index:2147483647;";
    document.body.appendChild(host);

    shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CSS;
    shadow.appendChild(style);

    toolbar = document.createElement("div");
    toolbar.className = "toolbar";

    // Position: centered below selection, fixed to viewport
    const margin = 8;
    let top = rect.bottom + margin;
    if (rect.bottom + 44 + margin > window.innerHeight) top = rect.top - 44 - margin;
    const left = rect.left + rect.width / 2;
    toolbar.style.top = top + "px";
    toolbar.style.left = left + "px";
    toolbar.style.transform = "translateX(-50%)";
    toolbar.style.pointerEvents = "auto";

    // Prevent mousedown inside toolbar from triggering document mouseup handler
    toolbar.addEventListener("mousedown", e => {
      e.preventDefault();
      suppressMouseup = true;
      setTimeout(() => { suppressMouseup = false; }, 200);
    });

    renderStep1();
    shadow.appendChild(toolbar);
    fetchTags();
  }

  function renderStep1() {
    toolbar.innerHTML = "";

    TYPES.forEach(type => {
      const btn = document.createElement("button");
      btn.className = "color-btn";
      btn.style.background = type.color;

      const tip = document.createElement("span");
      tip.className = "tooltip";
      tip.textContent = type.label;
      btn.appendChild(tip);

      btn.addEventListener("click", () => {
        activeType = type;
        const sel = window.getSelection();
        const range = (sel && sel.rangeCount > 0) ? sel.getRangeAt(0) : savedRange;
        highlightSpan = applyHighlight(range, type.color + "55");
        renderStep2();
      });

      toolbar.appendChild(btn);
    });
  }

  function renderStep2() {
    toolbar.innerHTML = "";
    removeDropdown();

    // Type pill
    const pill = document.createElement("span");
    pill.className = "type-pill";
    pill.style.background = activeType.color + "22";
    pill.style.color = activeType.color;
    pill.textContent = activeType.label;
    toolbar.appendChild(pill);

    const div1 = document.createElement("div");
    div1.className = "divider";
    toolbar.appendChild(div1);

    // Hash prefix
    const hash = document.createElement("span");
    hash.className = "hash";
    hash.textContent = "#";
    toolbar.appendChild(hash);

    // Tag input
    const tagInput = document.createElement("input");
    tagInput.className = "tag-input";
    tagInput.placeholder = "project/brief";
    tagInput.spellcheck = false;
    tagInput.autocomplete = "off";
    toolbar.appendChild(tagInput);

    // Note section (hidden until tag is chosen)
    const div2 = document.createElement("div");
    div2.className = "divider";
    div2.style.display = "none";
    toolbar.appendChild(div2);

    const noteInput = document.createElement("input");
    noteInput.className = "note-input";
    noteInput.placeholder = "add a note…";
    noteInput.style.display = "none";
    toolbar.appendChild(noteInput);

    // Save button
    const saveBtn = document.createElement("button");
    saveBtn.className = "save-btn";
    saveBtn.textContent = "Seed";
    toolbar.appendChild(saveBtn);

    function revealNote() {
      div2.style.display = "";
      noteInput.style.display = "";
      removeDropdown();
      noteInput.focus();
    }

    // Stop all keyboard events from reaching the page
    const stopProp = e => e.stopPropagation();
    [tagInput, noteInput].forEach(el => {
      ["keydown", "keyup", "keypress"].forEach(evt => el.addEventListener(evt, stopProp));
    });

    tagInput.addEventListener("input", () => {
      const q = tagInput.value.trim();
      showDropdown(tagInput, q, selected => {
        tagInput.value = selected;
        revealNote();
      });
    });

    tagInput.addEventListener("keydown", e => {
      if (e.key === "Enter") { revealNote(); }
      if (e.key === "Escape") { removeToolbar(); }
    });

    noteInput.addEventListener("keydown", e => {
      if (e.key === "Enter") { doSeed(); }
      if (e.key === "Escape") { removeToolbar(); }
    });

    saveBtn.addEventListener("click", doSeed);

    async function doSeed() {
      const tag = tagInput.value.trim().replace(/^#/, "");
      if (!tag) { tagInput.focus(); return; }

      saveBtn.disabled = true;
      saveBtn.textContent = "…";

      const note = noteInput.value.trim();
      const content = `[${activeType.label}] ${savedText}${note ? `\n\n_${note}_` : ""}`;

      try {
        const res = await bridgeFetch(`http://localhost:${RU_PORT}/seed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tag, content, source_url: savedUrl }),
        });

        // res.error = background couldn't reach bridge (Claude Desktop not running)
        // res.ok false = bridge reached but Obsidian returned an error
        if (res.error) throw Object.assign(new Error(res.error), { _nobridge: true });
        if (!res.ok) throw Object.assign(new Error(res.text), { _obsidian: true });

        const { savedTags = [] } = await chrome.storage.local.get("savedTags");
        if (!savedTags.includes(tag)) {
          await chrome.storage.local.set({ savedTags: [...savedTags, tag].sort() });
        }

        showStatus(`Saved to #${tag}`, "success");
        highlightSpan = null; // drop reference so removeHighlight() skips cleanup, leaving the highlight visible
        setTimeout(removeToolbar, 1400);

      } catch (err) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Seed";
        const msg = err._nobridge ? "Open Claude Desktop to save"
                  : err._obsidian ? "Open Obsidian to save"
                  : "Error saving";
        showStatus(msg, "error");
        setTimeout(() => { const s = shadow?.querySelector(".status"); if (s) s.remove(); }, 2000);
      }
    }

    setTimeout(() => { tagInput.focus(); tagInput.click(); }, 30);
  }

  function showStatus(msg, type) {
    toolbar.innerHTML = "";
    const s = document.createElement("span");
    s.className = "status " + type;
    s.textContent = msg;
    toolbar.appendChild(s);
  }

  // ── Event listeners ───────────────────────────────────────────────────────────

  document.addEventListener("mouseup", e => {
    setTimeout(() => {
      if (suppressMouseup) return;

      // Check if click was inside host or dropdown
      const path = e.composedPath?.() ?? [];
      if (host && path.includes(host)) return;
      if (dropdown && path.includes(dropdown)) return;

      if (!captureSelection()) {
        if (host && !path.includes(host)) removeToolbar();
        return;
      }

      const sel = window.getSelection();
      if (!sel?.rangeCount) return;
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (!rect.width && !rect.height) return;

      buildToolbar(rect);
    }, 15);
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") removeToolbar();
  });

  document.addEventListener("mousedown", e => {
    if (suppressMousedown) return;
    if (!host && !dropdown) return;
    const path = e.composedPath?.() ?? [];
    if (host && path.includes(host)) return;
    if (dropdown && path.includes(dropdown)) return;
    removeToolbar();
  });

})();
