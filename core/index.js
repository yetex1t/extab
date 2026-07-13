
/** @fileoverview Initializes i18n, search, suggestions, and module wiring. */

window.onload = function () {
    /** @type {!Object<string, string>} */
    const FALLBACK_TEXT = {
        ntPageTitle: "New Tab",
        ntSearchPlaceholder: "Type and search ...",
        ntSettingsAlt: "Settings",
        ntThemeLabel: "Dark Mode",
        ntSuggestLabel: "Suggestions",
        ntCustomLogoLabel: "Custom Logo",
        ntCustomLogoOpen: "Open",
        ntStatusOn: "On",
        ntStatusOff: "Off",
        ntLogoDropHint: "Double-click or drag image here",
        ntLogoHeightLabel: "Logo Height",
        ntLogoHeightDefault: "Default",
        ntLogoCrop: "Crop",
        ntLogoCropConfirm: "Confirm Crop",
        ntLogoReset: "Reset",
        ntLogoClear: "Clear",
        ntLogoConfirm: "Confirm",
        ntLogoCancel: "Cancel",
        ntLogoAlertNoImage: "Please choose an image first.",
        ntLogoAlertTooLarge: "Image too large, please choose an image smaller than 5MB.",
        ntLogoAlertSaveFail: "Unable to save logo."
    };

    /**
     * Detects locale used by this page.
     * @return {string} "zh" for Chinese locales, otherwise "en".
     */
    function getLocale() {
        const language = (
            (chrome.i18n && typeof chrome.i18n.getUILanguage === "function" && chrome.i18n.getUILanguage()) ||
            navigator.language ||
            ""
        ).toLowerCase();
        return language.indexOf("zh") === 0 ? "zh" : "en";
    }

    const locale = getLocale();

    /**
     * Reads localized message text with fallback.
     * @param {string} key Locale key.
     * @return {string} Localized or fallback text.
     */
    function getMessage(key) {
        if (chrome.i18n && typeof chrome.i18n.getMessage === "function") {
            const value = chrome.i18n.getMessage(key);
            if (value) {
                return value;
            }
        }
        return FALLBACK_TEXT[key] || "";
    }

    const text = {
        ntPageTitle: getMessage("ntPageTitle"),
        ntSearchPlaceholder: getMessage("ntSearchPlaceholder"),
        ntSettingsAlt: getMessage("ntSettingsAlt"),
        ntThemeLabel: getMessage("ntThemeLabel"),
        ntSuggestLabel: getMessage("ntSuggestLabel"),
        ntCustomLogoLabel: getMessage("ntCustomLogoLabel"),
        ntCustomLogoOpen: getMessage("ntCustomLogoOpen"),
        ntStatusOn: getMessage("ntStatusOn"),
        ntStatusOff: getMessage("ntStatusOff"),
        ntLogoDropHint: getMessage("ntLogoDropHint"),
        ntLogoHeightLabel: getMessage("ntLogoHeightLabel"),
        ntLogoHeightDefault: getMessage("ntLogoHeightDefault"),
        ntLogoCrop: getMessage("ntLogoCrop"),
        ntLogoCropConfirm: getMessage("ntLogoCropConfirm"),
        ntLogoReset: getMessage("ntLogoReset"),
        ntLogoClear: getMessage("ntLogoClear"),
        ntLogoConfirm: getMessage("ntLogoConfirm"),
        ntLogoCancel: getMessage("ntLogoCancel"),
        ntLogoAlertNoImage: getMessage("ntLogoAlertNoImage"),
        ntLogoAlertTooLarge: getMessage("ntLogoAlertTooLarge"),
        ntLogoAlertSaveFail: getMessage("ntLogoAlertSaveFail")
    };

    /**
     * Maps toggle state to localized status text.
     * @param {boolean} isEnabled Whether feature is enabled.
     * @return {string} Localized on/off text.
     */
    function statusText(isEnabled) {
        return isEnabled ? text.ntStatusOn : text.ntStatusOff;
    }

    /**
     * Verifies a value is a usable finite number.
     * @param {*} value Any value.
     * @return {boolean} True when finite numeric value.
     */
    function isFiniteNumber(value) {
        return typeof value === "number" && !isNaN(value) && isFinite(value);
    }

    /** Applies all static i18n attributes in the page markup. */
    function applyStaticI18n() {
        applyI18nForAttribute("[data-i18n]", "data-i18n", function (element, value) {
            element.textContent = value;
        });

        applyI18nForAttribute("[data-i18n-placeholder]", "data-i18n-placeholder", function (element, value) {
            element.placeholder = value;
        });

        applyI18nForAttribute("[data-i18n-alt]", "data-i18n-alt", function (element, value) {
            element.alt = value;
        });
    }

    /**
     * Applies i18n text to matching elements for one attribute kind.
     * @param {string} selector CSS selector for target elements.
     * @param {string} attributeName Attribute containing locale key.
     * @param {function(!Element, string): void} applyValue Callback to assign value.
     */
    function applyI18nForAttribute(selector, attributeName, applyValue) {
        const elements = document.querySelectorAll(selector);
        for (let i = 0; i < elements.length; i++) {
            const key = elements[i].getAttribute(attributeName);
            if (key && text[key]) {
                applyValue(elements[i], text[key]);
            }
        }
    }

    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    document.title = text.ntPageTitle;
    applyStaticI18n();

    const versionLabel = document.getElementById("version-label");
    const manifest = chrome.runtime.getManifest();
    versionLabel.textContent = "v" + manifest.version;

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

    const searchInput = document.getElementById("search-input");
    const searchButton = document.getElementById("search-button");
    const searchLogo = document.getElementById("search-logo");
    const suggestList = document.getElementById("suggest-list");
    const searchBox = document.getElementById("search-box");

    // Active engine is persisted as name; index is computed per runtime list.
    let currentEngineIndex = getStoredEngineIndex();
    updateSearchLogo();

    // Keyboard behavior: submit, navigate dropdown, and dismiss suggestions.
    searchInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            performSearch();
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            navigateSuggestions(event.key === "ArrowDown" ? 1 : -1);
        } else if (event.key === "Escape") {
            hideSuggestions();
        }
    });

    // Debounced input prevents flooding suggestion endpoints.
    let debounceTimer = null;
    searchInput.addEventListener("input", function () {
        clearTimeout(debounceTimer);
        const query = searchInput.value.trim();
        if (!query) {
            hideSuggestions();
            return;
        }
        debounceTimer = setTimeout(function () {
            fetchSuggestions(query);
        }, DEBOUNCE_DELAY);
    });

    document.addEventListener("click", function (event) {
        if (!event.target.closest("#search-box")) {
            hideSuggestions();
        }
    });

    searchButton.addEventListener("click", performSearch);
    searchLogo.addEventListener("click", switchSearchEngine);

    /**
     * Restores active search engine index from localStorage.
     * Falls back to locale default when value is missing/invalid.
     * @return {number} Valid index in `searchEngines`.
     */
    function getStoredEngineIndex() {
        const stored = localStorage.getItem("searchEngine");
        const localeDefaultEngineName = locale === "zh" ? "baidu" : "google";
        const localeDefaultIndex = searchEngines.findIndex(function (engine) {
            return engine.name === localeDefaultEngineName;
        });
        const fallbackIndex = localeDefaultIndex !== -1 ? localeDefaultIndex : 0;

        if (!stored) return fallbackIndex;
        const index = searchEngines.findIndex(function (engine) {
            return engine.name === stored;
        });
        return index !== -1 ? index : fallbackIndex;
    }

    /** Cycles to next engine and persists by semantic name. */
    function switchSearchEngine() {
        currentEngineIndex = (currentEngineIndex + 1) % searchEngines.length;
        localStorage.setItem("searchEngine", searchEngines[currentEngineIndex].name);
        updateSearchLogo();
        hideSuggestions();
    }

    /** Syncs icon button with current engine. */
    function updateSearchLogo() {
        searchLogo.style.backgroundImage = `url('${searchEngines[currentEngineIndex].icon}')`;
    }

    /**
     * Submits query through selected search engine.
     * Empty queries are ignored.
     */
    function performSearch() {
        const query = searchInput.value.trim();
        if (!query) return;
        hideSuggestions();
        const engine = searchEngines[currentEngineIndex];
        window.location.href = engine.url + encodeURIComponent(query);
    }

    let activeIndex = -1;
    // Default is enabled unless explicitly set to "off".
    let suggestEnabled = localStorage.getItem("suggest") !== "off";

    /** @return {boolean} Current suggestions enabled state. */
    function getSuggestEnabled() {
        return suggestEnabled;
    }

    /**
     * Updates in-memory suggestions state.
     * @param {boolean} value Next enabled state.
     */
    function setSuggestEnabled(value) {
        suggestEnabled = value;
    }

    /**
     * Fetches remote suggestions and renders only for current query.
     * Failure is non-fatal and only clears the dropdown.
     * @param {string} query Current input query.
     */
    function fetchSuggestions(query) {
        if (!suggestEnabled) return;
        const engine = searchEngines[currentEngineIndex];
        const url = engine.suggest + encodeURIComponent(query);

        fetch(url)
            .then(function (response) { return response.arrayBuffer(); })
            .then(function (buffer) {
                const decoder = new TextDecoder(engine.charset);
                const decodedText = decoder.decode(buffer);
                const data = JSON.parse(decodedText);
                const suggestions = (data[1] || []).slice(0, MAX_SUGGESTIONS);
                if (searchInput.value.trim() === query) {
                    renderSuggestions(suggestions);
                }
            })
            .catch(function () {
                hideSuggestions();
            });
    }

    /**
     * Renders suggestions list and click handlers.
     * @param {!Array<string>} suggestions Suggestion texts.
     */
    function renderSuggestions(suggestions) {
        activeIndex = -1;
        suggestList.innerHTML = "";

        if (suggestions.length === 0) {
            hideSuggestions();
            return;
        }

        for (let i = 0; i < suggestions.length; i++) {
            const item = document.createElement("div");
            item.className = "suggest-item";
            item.textContent = suggestions[i];

            item.addEventListener("mousedown", function (event) {
                event.preventDefault();
                searchInput.value = suggestions[i];
                performSearch();
            });

            suggestList.appendChild(item);
        }

        suggestList.style.display = "block";
        searchBox.classList.add("suggest-open");
    }

    /**
     * Moves keyboard highlight in suggestion list.
     * @param {number} direction 1 for down, -1 for up.
     */
    function navigateSuggestions(direction) {
        const items = suggestList.querySelectorAll(".suggest-item");
        if (items.length === 0) return;

        if (activeIndex >= 0 && activeIndex < items.length) {
            items[activeIndex].classList.remove("active");
        }

        activeIndex += direction;

        if (activeIndex >= items.length) {
            activeIndex = -1;
        } else if (activeIndex < -1) {
            activeIndex = items.length - 1;
        }

        if (activeIndex >= 0) {
            items[activeIndex].classList.add("active");
            searchInput.value = items[activeIndex].textContent;
        }
    }

    /** Hides and resets suggestion dropdown state. */
    function hideSuggestions() {
        suggestList.innerHTML = "";
        suggestList.style.display = "none";
        searchBox.classList.remove("suggest-open");
        activeIndex = -1;
    }

    const logoModule = typeof window.initLogoModule === "function"
        ? window.initLogoModule({ text: text, isFiniteNumber: isFiniteNumber })
        : null;

    if (typeof window.initSettingsModule === "function") {
        window.initSettingsModule({
            statusText: statusText,
            hideSuggestions: hideSuggestions,
            getSuggestEnabled: getSuggestEnabled,
            setSuggestEnabled: setSuggestEnabled,
            openLogoModal: logoModule && typeof logoModule.openLogoModal === "function"
                ? logoModule.openLogoModal
                : null
        });
    }
};
