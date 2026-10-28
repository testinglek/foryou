(() => {
  const qs = (sel, el = document) => el.querySelector(sel);
  const qsa = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  const state = {
    currentScene: "landing",
    mini: {
      turn: "user",
      userClicks: 0,
      targetMoves: 4,
      locked: false,
      resolveOnce: false,
      timerIds: [],
    },
    flower: {
      runId: 0,
    },
    gallery: {
      images: [],
      parallaxRaf: null,
      resizeHandler: null,
    },
  };

  const el = {
    scenes: qsa(".scene"),
    landingCard: qs("#landingCard"),
    loveToggle: qs("#loveToggle"),
    miniStatus: qs("#miniStatus"),
    gameGrid: qs("#gameGrid"),
    miniResult: qs("#miniResult"),
    miniResultText: qs("#miniResultText"),
    miniResultActions: qs("#miniResultActions"),
    lovePercent: qs("#lovePercent"),
    loveArc: qs("#gaugeArc"),
    loveBar: qs("#loveBar"),
    typedText: qs("#typedText"),
    typingScene: qs("#scene-typing"),
    galleryViewport: qs("#galleryViewport"),
    railA: qs("#railA"),
    railB: qs("#railB"),
    galleryTrack: qs("#galleryTrack"),
    modalOverlay: qs("#modalOverlay"),
    modalClose: qs("#modalClose"),
    modalImg: qs("#modalImg"),
    bgm: qs("#bgm"),

    // Scene 5: Flower
    rose: qs("#rose"),
    petalFallLayer: qs("#petalFallLayer"),
    flowerText: qs("#flowerText"),
    flowerCursor: qs("#flowerCursor") || qs(".flowerCursor"),
  };

  // 10 gambar default: pakai file lokal di folder ./img/
  // Ujungnya tetap "kena Pinterest" karena array ini nanti dipakai berulang untuk memenuhi kolom.
  const imagesDefault = [
    "./img/1.jpg",
    "./img/2.jpg",
    "./img/3.jpg",
    "./img/4.jpg",
    "./img/5.jpg",
    "./img/6.jpg",
    "./img/7.jpg",
    "./img/8.jpg",
    "./img/9.jpg",
    "./img/10.jpg",
  ];

  let bgmStarted = false;

  function startBgm() {
    if (!el.bgm) return;
    if (bgmStarted) return;
    bgmStarted = true;
    try {
      el.bgm.volume = 0.55;
      // Loop biar musiknya tetap jalan sampai user selesai menikmati semua scene
      el.bgm.loop = true;
      const p = el.bgm.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          // Autoplay policy kadang gagal jika user gesture kurang (tapi kita start setelah toggle biasanya aman)
          bgmStarted = false;
        });
      }
    } catch {
      bgmStarted = false;
    }
  }

  function setScene(sceneId) {
    const next = qs(`.scene[data-scene="${sceneId}"]`);
    if (!next) return;
    el.scenes.forEach((s) => s.classList.remove("is-active"));
    next.classList.add("is-active");
    state.currentScene = sceneId;
  }

  function transitionFromLandingToMini() {
    // Glowy feedback first
    el.landingCard.classList.add("is-glowing");
    el.loveToggle.disabled = true;
    setTimeout(() => {
      setScene("miniGame");
      resetMiniGame();
    }, 520);
  }

  function stopTimersMini() {
    state.mini.timerIds.forEach((id) => clearTimeout(id));
    state.mini.timerIds = [];
  }

  function buildGrid() {
    el.gameGrid.innerHTML = "";
    for (let i = 0; i < 9; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cell";
      btn.setAttribute("role", "gridcell");
      btn.dataset.index = String(i);
      btn.disabled = false;
      btn.addEventListener("click", onUserCellClick);
      el.gameGrid.appendChild(btn);
    }
  }

  function setMiniStatus(text) {
    el.miniStatus.textContent = text;
  }

  function setCellIcon(index, icon) {
    const cell = el.gameGrid.querySelector(`.cell[data-index="${index}"]`);
    if (!cell) return;
    cell.textContent = icon;
    cell.disabled = true;
    cell.classList.remove("animatePop");
    // Force reflow so animation restarts
    void cell.offsetWidth;
    cell.classList.add("animatePop", "is-active");
  }

  function getEmptyCells() {
    const cells = qsa(".cell", el.gameGrid);
    return cells.map((c, idx) => (c.textContent ? null : idx)).filter((v) => v !== null);
  }

  function onUserCellClick(e) {
    const cell = e.currentTarget;
    if (state.mini.locked) return;
    if (state.mini.turn !== "user") return;
    if (cell.disabled) return;

    state.mini.locked = true;
    const idx = Number(cell.dataset.index);

    state.mini.turn = "bot";
    state.mini.userClicks += 1;
    setCellIcon(idx, "❤️");

    setMiniStatus("Bot is thinking...");
    const thinkingDelay = 500 + Math.random() * 500; // 0.5–1s
    const t = window.setTimeout(() => {
      botMove();
    }, thinkingDelay);
    state.mini.timerIds.push(t);
  }

  function botMove() {
    const empty = getEmptyCells();
    if (empty.length === 0) {
      // If board is full, resolve as "try again" (should be rare)
      resolveMini(false, true);
      return;
    }

    const pick = empty[Math.floor(Math.random() * empty.length)];
    setCellIcon(pick, "💔");

    // Win decision: tidak harus nunggu grid "full" atau targetMoves selesai selalu.
    // Minimal beberapa langkah biar terasa gamenya, setelah itu bisa selesai lebih cepat.
    const minSteps = 2;
    const winProb = 0.75; // 70–80%

    const hardStop = state.mini.userClicks >= state.mini.targetMoves;
    const canEarly = state.mini.userClicks >= minSteps && state.mini.userClicks < state.mini.targetMoves;
    const earlyEnd = canEarly ? Math.random() < 0.35 : false;

    if (hardStop || earlyEnd) {
      const didWin = Math.random() < winProb;
      resolveMini(didWin, false);
      return;
    }

    // Continue with next user turn
    state.mini.turn = "user";
    state.mini.locked = false;
    setMiniStatus("Your turn");
  }

  function resolveMini(didWin, fullBoardFallback) {
    if (state.mini.resolveOnce) return;
    state.mini.resolveOnce = true;
    state.mini.locked = true;
    state.mini.turn = "done";

    el.miniResult.hidden = false;
    el.miniResultActions.innerHTML = "";

    if (didWin && !fullBoardFallback) {
      el.miniResultText.textContent = "You win ❤️";
      const t = window.setTimeout(() => {
        setScene("loading");
        startLoveIntensityLoading();
      }, 700);
      state.mini.timerIds.push(t);
    } else {
      el.miniResultText.textContent = "Almost... try again";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btnPrimary";
      btn.textContent = "Restart";
      btn.addEventListener("click", () => {
        state.mini.resolveOnce = false;
        state.mini.locked = false;
        state.mini.turn = "user";
        el.miniResult.hidden = true;
        resetMiniGame();
      });
      el.miniResultActions.appendChild(btn);
    }
  }

  function resetMiniGame() {
    stopTimersMini();
    state.mini = {
      ...state.mini,
      turn: "user",
      userClicks: 0,
      targetMoves: 4 + Math.floor(Math.random() * 2), // 4 or 5
      locked: false,
      resolveOnce: false,
      timerIds: [],
    };

    el.miniResult.hidden = true;
    el.miniResultText.textContent = "";
    el.miniResultActions.innerHTML = "";
    setMiniStatus("Your turn");
    buildGrid();
  }

  // Scene 3: Loading Love Intensity
  function startLoveIntensityLoading() {
    el.lovePercent.textContent = "0%";

    // Prepare SVG arc
    const arc = el.loveArc;
    const length = arc.getTotalLength();
    arc.style.strokeDasharray = String(length);
    arc.style.strokeDashoffset = String(length);

    const bar = el.loveBar;
    bar.style.width = "0%";

    const start = performance.now();
    const duration = 2600; // smooth to 100%

    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const pct = Math.round(t * 100);
      el.lovePercent.textContent = `${pct}%`;

      const dash = length * (1 - t);
      arc.style.strokeDashoffset = String(dash);

      bar.style.width = `${pct}%`;

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        // Slight pause so user feels "complete"
        setTimeout(() => setScene("typing"), 500);
        setTimeout(() => startTypingScene(), 700);
      }
    }

    requestAnimationFrame(frame);
  }

  // Scene 4: Typing Text
  function startTypingScene() {
    const text = "I Love You";
    el.typedText.textContent = "";

    const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const baseDelay = prefersReduced ? 0 : 70;

    let i = 0;
    function typeNext() {
      el.typedText.textContent = text.slice(0, i + 1);
      i += 1;
      if (i >= text.length) {
        setTimeout(() => {
          setScene("flower");
          startFlowerScene();
        }, 650);
        return;
      }
      const jitter = prefersReduced ? 0 : Math.random() * 30;
      setTimeout(typeNext, baseDelay + jitter);
    }
    if (prefersReduced) {
      el.typedText.textContent = text;
      setTimeout(() => {
        setScene("flower");
        startFlowerScene();
      }, 650);
    } else {
      typeNext();
    }
  }

  // Scene 5: Flower Bloom
  function buildPetals(count = 12) {
    if (!el.petalFallLayer) return;
    el.petalFallLayer.innerHTML = "";

    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const p = document.createElement("span");
      p.className = "fallPetal";

      const x = 6 + Math.random() * 88; // %
      const size = 8 + Math.random() * 8; // px
      const sway = -60 + Math.random() * 120; // px
      const rot = -18 + Math.random() * 36; // deg
      const dur = 5.6 + Math.random() * 2.8; // s
      const delay = -Math.random() * dur; // negative to randomize phase

      p.style.setProperty("--x", String(x));
      p.style.setProperty("--size", String(size));
      p.style.setProperty("--sway", `${sway}px`);
      p.style.setProperty("--rot", `${rot}deg`);
      p.style.setProperty("--dur", `${dur}s`);
      p.style.setProperty("--delay", `${delay}s`);

      frag.appendChild(p);
    }
    el.petalFallLayer.appendChild(frag);
  }

  function typeFlowerLines(lines, onDone) {
    if (!el.flowerText) return;
    const node = el.flowerText;
    const cursor = el.flowerCursor;

    if (cursor) {
      cursor.style.opacity = "1";
      cursor.style.transition = "opacity 200ms ease";
    }

    const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const perCharMs = prefersReduced ? 0 : 32;

    const runId = (state.flower.runId += 1);

    // Teks diketik per-barisan, tapi barisan lama TIDAK hilang.
    // Jadi kelihatan seperti paragraf panjang yang muncul pelan-pelan.
    const showLine = (text) => {
      const lineEl = document.createElement("span");
      lineEl.className = "flowerTypedLine";
      if (node.childNodes.length > 0) {
        node.appendChild(document.createElement("br"));
      }
      node.appendChild(lineEl);

      // Entry fade/slide untuk baris baru
      lineEl.style.opacity = "0";
      lineEl.style.transform = "translateY(10px) scale(.99)";
      lineEl.style.transition = "opacity 520ms ease, transform 520ms ease";

      requestAnimationFrame(() => {
        if (state.flower.runId !== runId) return;
        lineEl.style.opacity = "1";
        lineEl.style.transform = "translateY(0px) scale(1)";
      });

      if (perCharMs === 0) {
        lineEl.textContent = text;
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        let i = 0;
        const tick = () => {
          if (state.flower.runId !== runId) return;
          i += 1;
          lineEl.textContent = text.slice(0, i);
          if (i >= text.length) {
            resolve();
            return;
          }
          setTimeout(tick, perCharMs + Math.random() * 18);
        };
        tick();
      });
    };

    const run = async () => {
      // reset konten sebelum mulai
      node.textContent = "";

      for (let i = 0; i < lines.length; i++) {
        if (state.flower.runId !== runId) return;
        await showLine(lines[i]);
        if (state.flower.runId !== runId) return;
        await new Promise((r) => setTimeout(r, 520));
      }

      if (cursor) {
        cursor.style.opacity = "0";
      }
      onDone && onDone();
    };

    run();
  }

  function startFlowerScene() {
    if (!el.rose || !el.petalFallLayer || !el.flowerText) return;

    // reset animations
    el.rose.classList.remove("is-blooming");
    el.petalFallLayer.classList.add("is-paused");
    void el.rose.offsetWidth;

    buildPetals(12);
    el.rose.classList.add("is-blooming");

    // Start petals after bloom begins
    setTimeout(() => {
      if (state.currentScene !== "flower") return;
      el.petalFallLayer.classList.remove("is-paused");
    }, 520);

    const lines = ["aku cuma mau bilang...", "makasih ya", "udah mau bareng aku", "aku sayang kamu"];
    setTimeout(() => {
      typeFlowerLines(lines, () => {
        // Fade out happens via scene transition; we just sync the timing
        setTimeout(() => {
          setScene("gallery");
          setTimeout(() => startGallery(), 450);
        }, 1200);
      });
    }, 1020);
  }

  // Scene 6: Gallery (infinite loop + modal)
  function getColumnCount() {
    const w = window.innerWidth || 1000;
    if (w <= 480) return 2;
    if (w <= 900) return 3;
    return 4;
  }

  function getAspectForIndex(idx) {
    const list = ["1 / 5", "3 / 4", "1 / 1", "2 / 3", "5 / 6"];
    return list[idx % list.length];
  }

  function makeGalleryItems() {
    // Isi lebih banyak biar terasa “Pinterest”
    const cols = getColumnCount();
    const target = cols * 6; // contoh: 2->12, 3->18, 4->24
    return Array.from({ length: target }, (_, i) => imagesDefault[i % imagesDefault.length]);
  }

  function renderPinterestRail(railEl) {
    railEl.innerHTML = "";

    const cols = getColumnCount();
    const columns = [];

    const frag = document.createDocumentFragment();
    for (let c = 0; c < cols; c++) {
      const col = document.createElement("div");
      col.className = "pCol";
      columns.push(col);
      frag.appendChild(col);
    }

    state.gallery.images.forEach((url, idx) => {
      const colIndex = idx % cols;
      columns[colIndex].appendChild(createPhotoCard(url, idx));
    });

    railEl.appendChild(frag);
  }

  function renderGalleryRails() {
    renderPinterestRail(el.railA);
    renderPinterestRail(el.railB);
  }

  function createPhotoCard(url, idx) {
    const card = document.createElement("div");
    card.className = "photoCard";
    card.style.setProperty("--ar", getAspectForIndex(idx));
    card.style.setProperty("--d", `${(idx * 137) % 1200}ms`);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "photoBtn";
    btn.setAttribute("aria-label", "Buka foto");

    const img = document.createElement("img");
    img.src = url;
    img.alt = "Foto Valentine";
    img.loading = "lazy";
    img.decoding = "async";

    btn.appendChild(img);
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openModal(url);
    });
    card.appendChild(btn);
    return card;
  }

  function measureAndRestartGalleryAnimation() {
    const railA = el.railA;
    const railWidthRaw = railA.getBoundingClientRect().width;
    const railWidth = railWidthRaw > 0 ? railWidthRaw : railA.scrollWidth;

    // Update CSS variable for seamless shift
    el.galleryTrack.style.setProperty("--railShift", `${railWidth}px`);

    // Duration: proportional to width to keep motion calm
    const vw = window.innerWidth || 1000;
    const duration = Math.max(14, Math.min(32, railWidth / vw * 22));
    el.galleryTrack.style.setProperty("--galleryDuration", `${duration}s`);

    // Restart animation cleanly
    el.galleryTrack.style.animation = "none";
    // Force reflow
    void el.galleryTrack.offsetWidth;
    el.galleryTrack.style.animation = "";
  }

  function startGallery() {
    state.gallery.images = makeGalleryItems();
    renderGalleryRails();

    // Modal init
    el.modalOverlay.hidden = true;
    el.modalOverlay.classList.remove("is-open");

    // Infinite animation
    measureAndRestartGalleryAnimation();
    if (state.gallery.resizeHandler) {
      window.removeEventListener("resize", state.gallery.resizeHandler);
    }
    state.gallery.resizeHandler = () => {
      state.gallery.images = makeGalleryItems();
      renderGalleryRails();
      measureAndRestartGalleryAnimation();
    };
    window.addEventListener("resize", state.gallery.resizeHandler, { passive: true });

    // Parallax (subtle)
    const viewport = el.galleryViewport;
    let lastX = 0;
    let lastY = 0;

    const onMove = (ev) => {
      const rect = viewport.getBoundingClientRect();
      const x = (ev.clientX - rect.left) / rect.width; // 0..1
      const y = (ev.clientY - rect.top) / rect.height; // 0..1
      lastX = x;
      lastY = y;
      if (state.gallery.parallaxRaf) return;
      state.gallery.parallaxRaf = requestAnimationFrame(() => {
        state.gallery.parallaxRaf = null;
        const dx = (lastX - 0.5) * 22;
        const dy = (lastY - 0.5) * 18;
        viewport.style.setProperty("--mx", `${dx}px`);
        viewport.style.setProperty("--my", `${dy}px`);
      });
    };

    // Remove older listeners if any (best-effort)
    viewport.onmousemove = onMove;

    // Close modal handlers
    el.modalClose.onclick = closeModal;
    el.modalOverlay.onclick = (e) => {
      if (e.target === el.modalOverlay) closeModal();
    };
  }

  function onModalKeydown(e) {
    if (e.key === "Escape") closeModal();
  }

  function openModal(url) {
    el.modalImg.src = url;
    el.modalOverlay.hidden = false;
    el.modalOverlay.classList.add("is-open");
    el.galleryViewport.classList.add("is-blurred");
  }

  function closeModal() {
    el.modalOverlay.classList.remove("is-open");
    setTimeout(() => {
      el.modalOverlay.hidden = true;
      el.modalImg.src = "";
    }, 220);
    el.galleryViewport.classList.remove("is-blurred");
  }

  // Wire up toggle -> mini game
  el.loveToggle.addEventListener("change", () => {
    if (el.loveToggle.checked) {
      startBgm();
      transitionFromLandingToMini();
    }
  });

  // Init for mini grid (so it looks ready)
  buildGrid();

  // Modal keyboard
  document.addEventListener("keydown", onModalKeydown);
})();

