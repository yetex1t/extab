window.onload = function () {
    // Fallback strings used when locale entries are unavailable.
    const FALLBACK_TEXT = {
        ntPageTitle: "New Tab",
        ntSearchPlaceholder: "Type and search ...",
        ntSettingsAlt: "Settings",
        ntThemeLabel: "Dark Mode",
        ntSuggestLabel: "Suggestions",
        ntStatusOn: "On",
        ntStatusOff: "Off"
    };

    function GetLocale() {
        // Prefer Chrome UI language so extension text follows browser settings.
        const language = (
            (chrome.i18n && typeof chrome.i18n.getUILanguage === "function" && chrome.i18n.getUILanguage()) ||
            navigator.language ||
            ""
        ).toLowerCase();
        return language.indexOf("zh") === 0 ? "zh" : "en";
    }

    const locale = GetLocale();

    function GetMessage(key) {
        // Read from `_locales/*/messages.json` and fall back to English defaults.
        if (chrome.i18n && typeof chrome.i18n.getMessage === "function") {
            const value = chrome.i18n.getMessage(key);
            if (value) {
                return value;
            }
        }
        return FALLBACK_TEXT[key] || "";
    }

    const text = {
        ntPageTitle: GetMessage("ntPageTitle"),
        ntSearchPlaceholder: GetMessage("ntSearchPlaceholder"),
        ntSettingsAlt: GetMessage("ntSettingsAlt"),
        ntThemeLabel: GetMessage("ntThemeLabel"),
        ntSuggestLabel: GetMessage("ntSuggestLabel"),
        ntStatusOn: GetMessage("ntStatusOn"),
        ntStatusOff: GetMessage("ntStatusOff")
    };

    function StatusText(isEnabled) {
        return isEnabled ? text.ntStatusOn : text.ntStatusOff;
    }

    function ApplyStaticI18n() {
        // Update text nodes marked by `data-i18n`.
        const textElements = document.querySelectorAll("[data-i18n]");
        for (let i = 0; i < textElements.length; i++) {
            const key = textElements[i].getAttribute("data-i18n");
            if (key && text[key]) {
                textElements[i].textContent = text[key];
            }
        }

        // Update input placeholders marked by `data-i18n-placeholder`.
        const placeholderElements = document.querySelectorAll("[data-i18n-placeholder]");
        for (let i = 0; i < placeholderElements.length; i++) {
            const key = placeholderElements[i].getAttribute("data-i18n-placeholder");
            if (key && text[key]) {
                placeholderElements[i].placeholder = text[key];
            }
        }

        // Update alt attributes marked by `data-i18n-alt`.
        const altElements = document.querySelectorAll("[data-i18n-alt]");
        for (let i = 0; i < altElements.length; i++) {
            const key = altElements[i].getAttribute("data-i18n-alt");
            if (key && text[key]) {
                altElements[i].alt = text[key];
            }
        }
    }

    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    // Keep `<title>` in sync because browser tab text does not depend on body rendering.
    document.title = text.ntPageTitle;
    ApplyStaticI18n();

    // ==================== Version Label ====================

    const versionLabel = document.getElementById("version-label");
    const manifest = chrome.runtime.getManifest();
    versionLabel.textContent = "v" + manifest.version;

    // ==================== Search Engine Config ====================

    // Search engine definitions. Add a new engine entry here, including its suggest API URL.
    const searchEngines = [
        {
            name: "baidu",
            icon: "../img/baidu.png",
            url: "https://www.baidu.com/s?ie=utf-8&wd=",
            suggest: "https://suggestion.baidu.com/su?action=opensearch&wd=",
            charset: "gbk"
        },
        {
            name: "google",
            icon: "../img/google.png",
            url: "https://www.google.com/search?q=",
            suggest: "https://suggestqueries.google.com/complete/search?client=chrome&q=",
            charset: "utf-8"
        },
        {
            name: "bing",
            icon: "../img/bing.png",
            url: "https://www.bing.com/search?q=",
            suggest: "https://api.bing.com/osjson.aspx?query=",
            charset: "utf-8"
        }
    ];

    const MAX_SUGGESTIONS = 6;
    const DEBOUNCE_DELAY = 300;

    // ==================== Search ====================

    const searchInput = document.getElementById("search-input");
    const searchButton = document.getElementById("search-button");
    const searchLogo = document.getElementById("search-logo");
    const suggestList = document.getElementById("suggest-list");
    const searchBox = document.getElementById("search-box");

    // Restore the last selected search engine from localStorage.
    let currentEngineIndex = GetStoredEngineIndex();

    // Initialize the search engine icon.
    UpdateSearchLogo();

    // Press Enter to search. Use Arrow Up/Down to navigate suggestions.
    searchInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            PerformSearch();
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            NavigateSuggestions(event.key === "ArrowDown" ? 1 : -1);
        } else if (event.key === "Escape") {
            HideSuggestions();
        }
    });

    // Fetch suggestions on input with debounce.
    let debounceTimer = null;
    searchInput.addEventListener("input", function () {
        clearTimeout(debounceTimer);
        const query = searchInput.value.trim();
        if (!query) {
            HideSuggestions();
            return;
        }
        debounceTimer = setTimeout(function () {
            FetchSuggestions(query);
        }, DEBOUNCE_DELAY);
    });

    // Close the suggestions list when clicking outside the search box.
    document.addEventListener("click", function (event) {
        if (!event.target.closest("#search-box")) {
            HideSuggestions();
        }
    });

    // Trigger search when the search button is clicked.
    searchButton.addEventListener("click", PerformSearch);

    // Switch the search engine when the logo is clicked.
    searchLogo.addEventListener("click", SwitchSearchEngine);

    // Get the stored search engine index, falling back to locale default if invalid.
    function GetStoredEngineIndex() {
        const stored = localStorage.getItem("searchEngine");
        const localeDefaultEngineName = locale === "zh" ? "baidu" : "google";
        const localeDefaultIndex = searchEngines.findIndex(function (engine) {
            return engine.name === localeDefaultEngineName;
        });
        const fallbackIndex = localeDefaultIndex !== -1 ? localeDefaultIndex : 0;

        if (!stored) return fallbackIndex;
        const index = searchEngines.findIndex(function (e) { return e.name === stored; });
        return index !== -1 ? index : fallbackIndex;
    }

    // Rotate the search engine selection and persist it.
    function SwitchSearchEngine() {
        // Persist engine by name so future engine order changes do not break restore.
        currentEngineIndex = (currentEngineIndex + 1) % searchEngines.length;
        localStorage.setItem("searchEngine", searchEngines[currentEngineIndex].name);
        UpdateSearchLogo();
        HideSuggestions();
    }

    // Update the search engine icon.
    function UpdateSearchLogo() {
        searchLogo.style.backgroundImage = `url('${searchEngines[currentEngineIndex].icon}')`;
    }

    // Run a search by building the target URL and navigating to it.
    function PerformSearch() {
        const query = searchInput.value.trim();
        if (!query) return;
        HideSuggestions();
        const engine = searchEngines[currentEngineIndex];
        window.location.href = engine.url + encodeURIComponent(query);
    }

    // ==================== Suggestions ====================

    let activeIndex = -1; // Index of the currently highlighted suggestion.
    let suggestEnabled = localStorage.getItem("suggest") !== "off"; // Suggestions are enabled by default.

    // Request search suggestions.
    function FetchSuggestions(query) {
        if (!suggestEnabled) return;
        const engine = searchEngines[currentEngineIndex];
        const url = engine.suggest + encodeURIComponent(query);

        fetch(url)
            .then(function (response) { return response.arrayBuffer(); })
            .then(function (buffer) {
                // Decode by engine charset (Baidu uses GBK, others use UTF-8).
                const decoder = new TextDecoder(engine.charset);
                const text = decoder.decode(buffer);
                const data = JSON.parse(text);
                // OpenSearch JSON format: [query, [suggestions...]].
                const suggestions = (data[1] || []).slice(0, MAX_SUGGESTIONS);
                // Render only if input has not changed to avoid race conditions.
                if (searchInput.value.trim() === query) {
                    RenderSuggestions(suggestions);
                }
            })
            .catch(function () {
                // Treat fetch/parse failures as non-fatal and hide suggestion UI.
                HideSuggestions();
            });
    }

    // Render the suggestions list.
    function RenderSuggestions(suggestions) {
        activeIndex = -1;
        suggestList.innerHTML = "";

        if (suggestions.length === 0) {
            HideSuggestions();
            return;
        }

        for (let i = 0; i < suggestions.length; i++) {
            const item = document.createElement("div");
            item.className = "suggest-item";
            item.textContent = suggestions[i];

            // Search immediately when a suggestion is clicked.
            item.addEventListener("mousedown", function (event) {
                event.preventDefault();
                searchInput.value = suggestions[i];
                PerformSearch();
            });

            suggestList.appendChild(item);
        }

        suggestList.style.display = "block";
        searchBox.classList.add("suggest-open");
    }

    // Navigate the suggestions list with Arrow Up/Down keys.
    function NavigateSuggestions(direction) {
        const items = suggestList.querySelectorAll(".suggest-item");
        if (items.length === 0) return;

        // Remove the current highlight.
        if (activeIndex >= 0 && activeIndex < items.length) {
            items[activeIndex].classList.remove("active");
        }

        activeIndex += direction;

        // Cycle selection: out-of-range wraps to -1 or the last item.
        if (activeIndex >= items.length) {
            activeIndex = -1;
        } else if (activeIndex < -1) {
            activeIndex = items.length - 1;
        }

        // Highlight the new option and copy it into the input.
        if (activeIndex >= 0) {
            items[activeIndex].classList.add("active");
            searchInput.value = items[activeIndex].textContent;
        }
    }

    // Hide the suggestions list.
    function HideSuggestions() {
        suggestList.innerHTML = "";
        suggestList.style.display = "none";
        searchBox.classList.remove("suggest-open");
        activeIndex = -1;
    }

    // ==================== Settings Menu ====================

    const settingsButton = document.getElementById("settings-button");
    const settingsMenu = document.getElementById("settings-menu");
    const themeToggle = document.getElementById("theme-toggle");
    const themeStatus = document.getElementById("theme-status");
    const suggestToggle = document.getElementById("suggest-toggle");
    const suggestStatus = document.getElementById("suggest-status");

    // Restore theme from localStorage.
    const isDarkInit = localStorage.getItem("theme") === "dark";
    if (isDarkInit) {
        document.body.classList.add("dark-mode");
    }
    themeStatus.textContent = StatusText(isDarkInit);

    // Restore suggestions toggle state from localStorage.
    suggestStatus.textContent = StatusText(suggestEnabled);

    // Toggle settings menu visibility when clicking the settings button.
    settingsButton.addEventListener("click", function (event) {
        event.stopPropagation();
        const isOpen = settingsMenu.style.display === "block";
        settingsMenu.style.display = isOpen ? "none" : "block";
    });

    // Close the settings menu when clicking outside it.
    document.addEventListener("click", function (event) {
        if (!event.target.closest("#settings-wrapper")) {
            settingsMenu.style.display = "none";
        }
    });

    // Toggle dark mode.
    themeToggle.addEventListener("click", function () {
        document.body.classList.toggle("dark-mode");
        const isDark = document.body.classList.contains("dark-mode");
        themeStatus.textContent = StatusText(isDark);
        localStorage.setItem("theme", isDark ? "dark" : "light");
    });

    // Toggle search suggestions.
    suggestToggle.addEventListener("click", function () {
        suggestEnabled = !suggestEnabled;
        suggestStatus.textContent = StatusText(suggestEnabled);
        localStorage.setItem("suggest", suggestEnabled ? "on" : "off");
        if (!suggestEnabled) {
            HideSuggestions();
        }
    });
};
