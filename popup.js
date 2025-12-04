document.addEventListener("DOMContentLoaded", () => {
  const searchBtn = document.getElementById("searchBtn");
  const queryInput = document.getElementById("searchInput");
  const resultsDiv = document.getElementById("results");
  const emptyState = document.getElementById("emptyState");
  const errorState = document.getElementById("errorState");
  const retryBtn = document.getElementById("retryBtn");
  const searchText = searchBtn.querySelector(".search-text");
  const spinner = searchBtn.querySelector(".spinner");

  chrome.storage.local.get(["lastQuery"], (data) => {
    if (data.lastQuery) queryInput.value = data.lastQuery;
  });

  function cleanSubtitleName(name) {
    if (!name) return null;
    let cleaned = name.replace(/[^\w\s.\-()]/g, "");
    cleaned = cleaned.replace(/\s+/g, " ").trim();
    if (cleaned.length > 60) {
      cleaned = cleaned.substring(0, 57) + "...";
    }
    return cleaned || null;
  }

  function safeTextNode(text) {
    return document.createTextNode(text || "");
  }

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  async function runSearch() {
    const query = queryInput.value.trim();
    clearNode(resultsDiv);

    if (!query) {
      const p = document.createElement("p");
      p.textContent = "Please enter a movie or series name.";
      resultsDiv.appendChild(p);
      return;
    }

    spinner.classList.remove("hidden");
    searchText.classList.add("hidden");

    chrome.storage.local.set({ lastQuery: query });
    emptyState.classList.add("hidden");
    errorState.classList.add("hidden");

    chrome.runtime.sendMessage({ action: "searchSubtitles", query }, (response) => {
      spinner.classList.add("hidden");
      searchText.classList.remove("hidden");

      clearNode(resultsDiv);

      if (!response) {
        const p = document.createElement("p");
        p.style.color = "red";
        p.textContent = "No response from background.";
        resultsDiv.appendChild(p);
        return;
      }

      if (response.error) {
        console.error("Search error:", response.error);
        errorState.classList.remove("hidden");
        return;
      }

      let subtitles = response.subtitles || [];
      const queryLower = query.toLowerCase().trim();

      let exactMatches = subtitles.filter(sub => {
        const fd = sub.attributes?.feature_details || {};
        return (fd.title || "").toLowerCase().trim() === queryLower;
      });

      if (exactMatches.length === 0) {
        exactMatches = subtitles.filter(sub => {
          const fd = sub.attributes?.feature_details || {};
          return (fd.title || "").toLowerCase().includes(queryLower);
        });
      }

      subtitles = exactMatches;

      if (!subtitles.length) {
        emptyState.classList.remove("hidden");
        return;
      }

      subtitles.forEach((sub) => {
        const attrs = sub.attributes || {};
        const file = (attrs.files || [])[0];
        const fileId = file?.file_id;
        const fd = attrs.feature_details || {};

        const title = fd.title || attrs.release || "Unknown title";
        const year = fd.year ? ` (${fd.year})` : "";
        const subtitleName = cleanSubtitleName(attrs.release)
          || cleanSubtitleName(file?.file_name)
          || "Subtitle File";
        const lang = attrs.language || "N/A";

        const card = document.createElement("div");
        card.className =
          "subtitle-card p-4 bg-slate-800/50 border border-slate-700 rounded-xl transition-transform duration-200 relative";

        const titleP = document.createElement("p");
        titleP.className = "font-semibold text-white";
        titleP.textContent = title + year;

        const nameP = document.createElement("p");
        nameP.className = "text-slate-300 text-xs mt-1";
        nameP.textContent = subtitleName;

        const langP = document.createElement("p");
        langP.className = "text-slate-400 text-sm";
        langP.textContent = "Language: " + lang;

        const downloadBtn = document.createElement("button");
        downloadBtn.className = "downloadBtn";
        downloadBtn.title = "Download";

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("viewBox", "0 0 24 24");

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        path.setAttribute(
          "d",
          "M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2m-4-4l-4 4m0 0l-4-4m4 4V4"
        );

        svg.appendChild(path);
        downloadBtn.appendChild(svg);

        downloadBtn.addEventListener("click", () => {
          if (fileId) {
            chrome.runtime.sendMessage({ action: "downloadSubtitle", fileId });
          } else {
            alert("No subtitle file available to download");
          }
        });

        card.appendChild(titleP);
        card.appendChild(nameP);
        card.appendChild(langP);
        card.appendChild(downloadBtn);

        resultsDiv.appendChild(card);
      });
    });
  }

  searchBtn.addEventListener("click", runSearch);
  retryBtn.addEventListener("click", runSearch);
  queryInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") runSearch();
  });
});
