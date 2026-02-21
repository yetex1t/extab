
/** @fileoverview Manages custom logo upload, crop, preview, and persistence. */

/**
 * Initializes custom logo modal and returns public controls.
 * @param {{
 *   text: !Object<string, string>,
 *   isFiniteNumber: function(*): boolean
 * }} context Shared i18n text and utility helpers.
 * @return {{openLogoModal: function(): void}} Public module API.
 */
window.initLogoModule = function (context) {
    const text = context.text;
    const isFiniteNumber = context.isFiniteNumber;

    const pageLogo = document.getElementById("logo");
    const logoModal = document.getElementById("logo-modal");
    const logoDropZone = document.getElementById("logo-drop-zone");
    const logoDropHint = document.getElementById("logo-drop-hint");
    const logoCropCanvas = document.getElementById("logo-crop-canvas");
    const logoCropBox = document.getElementById("logo-crop-box");
    const logoHeightInput = document.getElementById("logo-height-input");
    const logoHeightDefault = document.getElementById("logo-height-default");
    const logoCropBtn = document.getElementById("logo-crop-btn");
    const logoCropConfirmBtn = document.getElementById("logo-crop-confirm-btn");
    const logoResetBtn = document.getElementById("logo-reset-btn");
    const logoConfirmBtn = document.getElementById("logo-confirm-btn");
    const logoClearBtn = document.getElementById("logo-clear-btn");
    const logoCancelBtn = document.getElementById("logo-cancel-btn");

    if (
        !pageLogo ||
        !logoModal ||
        !logoDropZone ||
        !logoCropCanvas ||
        !logoCropBox ||
        !logoHeightInput ||
        !logoHeightDefault ||
        !logoCropBtn ||
        !logoCropConfirmBtn ||
        !logoResetBtn ||
        !logoConfirmBtn ||
        !logoClearBtn ||
        !logoCancelBtn
    ) {
        return {
            openLogoModal: function () {}
        };
    }

    const CUSTOM_PAGE_LOGO_KEY = "customPageLogo";
    const CUSTOM_PAGE_LOGO_HEIGHT_KEY = "customPageLogoHeight";
    // Conservative quota guard for data URLs stored in localStorage.
    const LOCAL_STORAGE_LIMIT_BYTES = 5 * 1024 * 1024;
    const DEFAULT_PAGE_LOGO_SRC = pageLogo.getAttribute("src") || "";
    const DEFAULT_PAGE_LOGO_HEIGHT = pageLogo.clientHeight || 120;
    // Modal input defaults to 90px display value by product requirement.
    const DEFAULT_MODAL_HEIGHT_INPUT = 90;

    const logoCanvasCtx = logoCropCanvas.getContext("2d");
    const MIN_CROP_SIZE = 40;
    const logoFileInput = document.createElement("input");

    let modalImageDataUrl = "";
    let sourceImage = null;
    let imageDrawRect = null;
    let cropDragState = null;
    let cropModeActive = false;

    logoFileInput.type = "file";
    logoFileInput.accept = "image/*";
    logoFileInput.style.display = "none";
    document.body.appendChild(logoFileInput);

    logoFileInput.addEventListener("change", function () {
        const file = logoFileInput.files && logoFileInput.files[0];
        if (!file) return;
        loadModalImage(file);
    });

    logoModal.addEventListener("click", function (event) {
        if (event.target === logoModal) {
            closeLogoModal();
        }
    });

    logoDropZone.addEventListener("dblclick", function () {
        openImagePicker();
    });

    logoDropZone.addEventListener("dragover", function (event) {
        event.preventDefault();
        logoDropZone.classList.add("dragover");
    });

    logoDropZone.addEventListener("dragleave", function (event) {
        if (!logoDropZone.contains(event.relatedTarget)) {
            logoDropZone.classList.remove("dragover");
        }
    });

    logoDropZone.addEventListener("drop", function (event) {
        event.preventDefault();
        logoDropZone.classList.remove("dragover");
        const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
        if (!file) return;
        loadModalImage(file);
    });

    logoCropBox.addEventListener("mousedown", startCropDrag);
    logoCropBox.addEventListener("touchstart", startCropDrag, { passive: false });
    window.addEventListener("mousemove", moveCropDrag);
    window.addEventListener("touchmove", moveCropDrag, { passive: false });
    window.addEventListener("mouseup", endCropDrag);
    window.addEventListener("touchend", endCropDrag);

    logoCropBtn.addEventListener("click", function () {
        if (!sourceImage || !imageDrawRect) {
            alert(text.ntLogoAlertNoImage);
            return;
        }
        setCropMode(true);
        logoCropConfirmBtn.textContent = text.ntLogoCropConfirm;
        resetCropBox();
    });

    logoCropConfirmBtn.addEventListener("click", function () {
        cropCurrentModalImage();
        setCropMode(false);
    });

    logoResetBtn.addEventListener("click", function () {
        clearCustomLogoStorage();
        restoreDefaultPageLogo();
        closeLogoModal();
    });

    logoClearBtn.addEventListener("click", function () {
        resetLogoModalState();
    });

    logoCancelBtn.addEventListener("click", function () {
        closeLogoModal();
    });

    logoConfirmBtn.addEventListener("click", function () {
        if (logoConfirmBtn.disabled || !modalImageDataUrl) {
            return;
        }

        // Estimate projected storage before writing large image payload.
        const nextLogoSize = estimateStorageBytes(modalImageDataUrl);
        const currentUsage = getLocalStorageUsageBytes();
        const previousLogo = localStorage.getItem(CUSTOM_PAGE_LOGO_KEY) || "";
        const previousLogoSize = estimateStorageBytes(previousLogo);
        const projectedUsage = currentUsage - previousLogoSize + nextLogoSize;
        if (projectedUsage > LOCAL_STORAGE_LIMIT_BYTES) {
            alert(getTooLargeImageMessage());
            return;
        }

        const parsedHeight = parseInt(logoHeightInput.value, 10);
        const inputHeight = isFiniteNumber(parsedHeight) ? parsedHeight : DEFAULT_PAGE_LOGO_HEIGHT;
        const finalHeight = inputHeight > 0 ? inputHeight : DEFAULT_PAGE_LOGO_HEIGHT;
        logoHeightInput.value = String(finalHeight);

        try {
            localStorage.setItem(CUSTOM_PAGE_LOGO_KEY, modalImageDataUrl);
            localStorage.setItem(CUSTOM_PAGE_LOGO_HEIGHT_KEY, String(finalHeight));
            applyPageLogo(modalImageDataUrl, finalHeight);
            closeLogoModal();
        } catch (error) {
            // Storage writes can fail on quota or browser policy limits.
            alert(text.ntLogoAlertSaveFail);
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && isLogoModalOpen()) {
            closeLogoModal();
        }
    });

    restoreCustomPageLogo();

    /**
     * Applies selected logo and requested display height.
     * @param {string} dataUrl Base64 image data URL.
     * @param {number} height Target display height in px.
     */
    function applyPageLogo(dataUrl, height) {
        pageLogo.src = dataUrl;
        applyPageLogoDisplayHeight(height);

        if (!pageLogo.complete || pageLogo.naturalHeight === 0) {
            pageLogo.addEventListener("load", function () {
                applyPageLogoDisplayHeight(height);
            }, { once: true });
        }
    }

    /**
     * Adjusts inline logo size to preserve image ratio.
     * @param {number} height Preferred display height in px.
     */
    function applyPageLogoDisplayHeight(height) {
        const targetHeight = isFiniteNumber(height) && height > 0 ? height : DEFAULT_PAGE_LOGO_HEIGHT;
        const naturalWidth = pageLogo.naturalWidth;
        const naturalHeight = pageLogo.naturalHeight;

        if (naturalWidth > 0 && naturalHeight > 0) {
            const scale = targetHeight / naturalHeight;
            const scaledWidth = Math.round(naturalWidth * scale);
            pageLogo.style.width = scaledWidth + "px";
            pageLogo.style.height = targetHeight + "px";
        } else {
            pageLogo.style.width = "auto";
            pageLogo.style.height = targetHeight + "px";
        }

        pageLogo.style.maxWidth = "none";
        pageLogo.style.objectFit = "contain";
    }

    /** Restores original bundled logo and removes inline sizing overrides. */
    function restoreDefaultPageLogo() {
        pageLogo.src = DEFAULT_PAGE_LOGO_SRC;
        pageLogo.style.height = "";
        pageLogo.style.width = "";
        pageLogo.style.maxWidth = "";
        pageLogo.style.objectFit = "";
    }

    /** Restores persisted custom logo when valid, otherwise falls back to default. */
    function restoreCustomPageLogo() {
        const customLogo = localStorage.getItem(CUSTOM_PAGE_LOGO_KEY);
        if (!customLogo || customLogo.indexOf("data:image/") !== 0) {
            restoreDefaultPageLogo();
            return;
        }
        const height = getStoredLogoHeight();
        applyPageLogo(customLogo, height);
    }

    /** Opens modal and resets transient editor state. */
    function openLogoModal() {
        resetLogoModalState();
        setLogoModalVisible(true);

        // Input display resets on each open without mutating saved logo size.
        logoHeightInput.value = String(DEFAULT_MODAL_HEIGHT_INPUT);
        logoHeightDefault.textContent = `${text.ntLogoHeightDefault}: ${DEFAULT_MODAL_HEIGHT_INPUT}px`;
    }

    /**
     * Reads stored custom logo height.
     * @return {number} Stored height or default height.
     */
    function getStoredLogoHeight() {
        const storedHeight = parseInt(localStorage.getItem(CUSTOM_PAGE_LOGO_HEIGHT_KEY), 10);
        return isFiniteNumber(storedHeight) ? storedHeight : DEFAULT_PAGE_LOGO_HEIGHT;
    }

    /** Closes modal and resets input value to modal default. */
    function closeLogoModal() {
        restoreCustomPageLogo();
        setLogoModalVisible(false);
        resetLogoModalState();
        logoHeightInput.value = String(DEFAULT_MODAL_HEIGHT_INPUT);
    }

    /** Clears saved custom logo payload and saved height. */
    function clearCustomLogoStorage() {
        localStorage.removeItem(CUSTOM_PAGE_LOGO_KEY);
        localStorage.removeItem(CUSTOM_PAGE_LOGO_HEIGHT_KEY);
    }

    /** @return {boolean} Whether logo modal is currently open. */
    function isLogoModalOpen() {
        return logoModal.classList.contains("open");
    }

    /**
     * Toggles modal visibility and keeps ARIA state in sync.
     * @param {boolean} visible Whether modal should be visible.
     */
    function setLogoModalVisible(visible) {
        if (!visible) {
            releaseModalFocusBeforeHide();
        }
        logoModal.classList.toggle("open", visible);
        logoModal.setAttribute("aria-hidden", visible ? "false" : "true");
    }

    /**
     * Moves focus out of the modal before it becomes aria-hidden.
     * This prevents accessibility warnings when a focused modal control is hidden.
     */
    function releaseModalFocusBeforeHide() {
        const activeElement = document.activeElement;
        if (!(activeElement instanceof HTMLElement)) {
            return;
        }
        if (!logoModal.contains(activeElement)) {
            return;
        }
        activeElement.blur();
    }

    /** Resets modal editing state without touching persisted logo data. */
    function resetLogoModalState() {
        resetEditorState(true);
        setCropMode(false);
        clearCanvas();
        toggleHint(true);
        updateConfirmButtonState();
    }

    /**
     * Toggles crop mode UI.
     * @param {boolean} isActive Whether crop mode is enabled.
     */
    function setCropMode(isActive) {
        cropModeActive = isActive;
        logoCropBox.style.display = isActive ? "block" : "none";
        logoCropConfirmBtn.classList.toggle("visible", isActive);
    }

    /** Clears crop canvas using a theme-aware background color. */
    function clearCanvas() {
        logoCanvasCtx.clearRect(0, 0, logoCropCanvas.width, logoCropCanvas.height);
        logoCanvasCtx.fillStyle = document.body.classList.contains("dark-mode") ? "#232323" : "#f5f5f5";
        logoCanvasCtx.fillRect(0, 0, logoCropCanvas.width, logoCropCanvas.height);
    }

    function toggleHint(show) {
        logoDropHint.style.display = show ? "block" : "none";
        if (show) {
            logoCropBox.style.display = "none";
        }
    }

    /**
     * Opens native image picker when available.
     * Uses `click()` fallback for older browsers.
     */
    function openImagePicker() {
        logoFileInput.value = "";
        if (typeof logoFileInput.showPicker === "function") {
            try {
                logoFileInput.showPicker();
            } catch (error) {
            }
            return;
        }
        try {
            logoFileInput.click();
        } catch (error) {
        }
    }

    /**
     * Loads dropped/selected image file into modal editor.
     * @param {!File} file Candidate image file.
     */
    function loadModalImage(file) {
        if (!file.type || file.type.indexOf("image/") !== 0) {
            return;
        }

        const reader = new FileReader();
        reader.onload = function () {
            const result = reader.result;
            if (typeof result !== "string") {
                return;
            }

            loadModalImageFromDataUrl(result);
        };
        reader.readAsDataURL(file);
    }

    /**
     * Loads image data URL into editor state and preview canvas.
     * @param {string} dataUrl Selected image data URL.
     */
    function loadModalImageFromDataUrl(dataUrl) {
        setCropMode(false);
        resetEditorState(true);
        clearCanvas();
        toggleHint(true);
        const image = new Image();
        image.onload = function () {
            modalImageDataUrl = dataUrl;
            sourceImage = image;
            drawModalImage();
            toggleHint(false);
            updateConfirmButtonState();
        };
        image.src = dataUrl;
    }

    /**
     * Resets transient editor state.
     * @param {boolean} clearImageData Whether to clear current image payload.
     */
    function resetEditorState(clearImageData) {
        cropDragState = null;
        imageDrawRect = null;
        sourceImage = null;
        if (clearImageData) {
            modalImageDataUrl = "";
        }
    }

    /** Enables confirm button only when an image payload is present. */
    function updateConfirmButtonState() {
        logoConfirmBtn.disabled = !modalImageDataUrl;
    }

    /**
     * Builds user-facing size error with localized fallback.
     * @return {string} Error message for oversize images.
     */
    function getTooLargeImageMessage() {
        const maxMb = (LOCAL_STORAGE_LIMIT_BYTES / (1024 * 1024)).toFixed(1).replace(/\.0$/, "");
        return text.ntLogoAlertTooLarge || `Image too large, please choose an image smaller than ${maxMb}MB.`;
    }

    /**
     * Draws source image fitted in preview canvas and records draw bounds.
     * Draw bounds are later used for crop coordinate conversion.
     */
    function drawModalImage() {
        const width = logoCropCanvas.clientWidth;
        const height = logoCropCanvas.clientHeight;
        logoCropCanvas.width = width;
        logoCropCanvas.height = height;

        clearCanvas();
        if (!sourceImage) return;

        const imageRatio = sourceImage.naturalWidth / sourceImage.naturalHeight;
        const canvasRatio = width / height;
        let drawWidth = width;
        let drawHeight = height;
        if (imageRatio > canvasRatio) {
            drawHeight = width / imageRatio;
        } else {
            drawWidth = height * imageRatio;
        }

        const drawX = (width - drawWidth) / 2;
        const drawY = (height - drawHeight) / 2;
        imageDrawRect = {
            x: drawX,
            y: drawY,
            width: drawWidth,
            height: drawHeight
        };

        logoCanvasCtx.drawImage(sourceImage, drawX, drawY, drawWidth, drawHeight);

        logoCanvasCtx.strokeStyle = "#ffffff";
        logoCanvasCtx.lineWidth = 1;
        logoCanvasCtx.strokeRect(drawX + 0.5, drawY + 0.5, drawWidth - 1, drawHeight - 1);

        logoCanvasCtx.setLineDash([5, 4]);
        logoCanvasCtx.strokeStyle = "#2f3a55";
        logoCanvasCtx.strokeRect(drawX + 0.5, drawY + 0.5, drawWidth - 1, drawHeight - 1);
        logoCanvasCtx.setLineDash([]);
    }

    /** Resets crop box to a centered rectangle inside drawn image bounds. */
    function resetCropBox() {
        if (!imageDrawRect) {
            return;
        }
        const width = imageDrawRect.width * 0.6;
        const height = imageDrawRect.height * 0.6;
        const x = imageDrawRect.x + (imageDrawRect.width - width) / 2;
        const y = imageDrawRect.y + (imageDrawRect.height - height) / 2;
        updateCropBoxRect({ x: x, y: y, width: width, height: height });
    }

    /**
     * Reads current crop box rectangle from inline styles.
     * @return {{x: number, y: number, width: number, height: number}} Crop rectangle.
     */
    function getCropBoxRect() {
        const left = parseFloat(logoCropBox.style.left || "0");
        const top = parseFloat(logoCropBox.style.top || "0");
        const width = parseFloat(logoCropBox.style.width || "0");
        const height = parseFloat(logoCropBox.style.height || "0");
        return { x: left, y: top, width: width, height: height };
    }

    /**
     * Applies crop rectangle after enforcing bounds.
     * @param {{x: number, y: number, width: number, height: number}} rect Proposed rectangle.
     */
    function updateCropBoxRect(rect) {
        const bounded = keepCropRectInImage(rect);
        logoCropBox.style.left = bounded.x + "px";
        logoCropBox.style.top = bounded.y + "px";
        logoCropBox.style.width = bounded.width + "px";
        logoCropBox.style.height = bounded.height + "px";
    }

    /**
     * Keeps crop rectangle inside image and above minimum size.
     * @param {{x: number, y: number, width: number, height: number}} rect Input rectangle.
     * @return {{x: number, y: number, width: number, height: number}} Corrected rectangle.
     */
    function keepCropRectInImage(rect) {
        if (!imageDrawRect) {
            return rect;
        }

        let width = Math.max(MIN_CROP_SIZE, rect.width);
        let height = Math.max(MIN_CROP_SIZE, rect.height);
        let x = rect.x;
        let y = rect.y;

        if (width > imageDrawRect.width) width = imageDrawRect.width;
        if (height > imageDrawRect.height) height = imageDrawRect.height;

        if (x < imageDrawRect.x) x = imageDrawRect.x;
        if (y < imageDrawRect.y) y = imageDrawRect.y;
        if (x + width > imageDrawRect.x + imageDrawRect.width) {
            x = imageDrawRect.x + imageDrawRect.width - width;
        }
        if (y + height > imageDrawRect.y + imageDrawRect.height) {
            y = imageDrawRect.y + imageDrawRect.height - height;
        }

        return {
            x: x,
            y: y,
            width: width,
            height: height
        };
    }

    /**
     * Starts drag interaction for moving/resizing crop box.
     * @param {!Event} event Mouse or touch start event.
     */
    function startCropDrag(event) {
        if (!imageDrawRect || !cropModeActive || logoCropBox.style.display === "none") return;
        event.preventDefault();
        const point = getEventPoint(event);
        const target = event.target;
        const handle = target.classList.contains("crop-handle") ? target.getAttribute("data-handle") : "move";
        cropDragState = {
            mode: handle,
            startX: point.x,
            startY: point.y,
            rect: getCropBoxRect()
        };
    }

    /**
     * Updates crop box while dragging.
     * @param {!Event} event Mouse or touch move event.
     */
    function moveCropDrag(event) {
        if (!cropDragState) return;
        event.preventDefault();
        const point = getEventPoint(event);
        const deltaX = point.x - cropDragState.startX;
        const deltaY = point.y - cropDragState.startY;
        const startRect = cropDragState.rect;
        let nextRect = {
            x: startRect.x,
            y: startRect.y,
            width: startRect.width,
            height: startRect.height
        };

        if (cropDragState.mode === "move") {
            nextRect.x += deltaX;
            nextRect.y += deltaY;
        } else if (cropDragState.mode === "nw") {
            nextRect.x += deltaX;
            nextRect.y += deltaY;
            nextRect.width -= deltaX;
            nextRect.height -= deltaY;
        } else if (cropDragState.mode === "ne") {
            nextRect.y += deltaY;
            nextRect.width += deltaX;
            nextRect.height -= deltaY;
        } else if (cropDragState.mode === "sw") {
            nextRect.x += deltaX;
            nextRect.width -= deltaX;
            nextRect.height += deltaY;
        } else if (cropDragState.mode === "se") {
            nextRect.width += deltaX;
            nextRect.height += deltaY;
        }

        updateCropBoxRect(nextRect);
    }

    /** Ends current crop drag interaction. */
    function endCropDrag() {
        cropDragState = null;
    }

    /**
     * Converts pointer event coordinates to drop-zone local coordinates.
     * @param {!Event} event Mouse or touch event.
     * @return {{x: number, y: number}} Local point coordinates.
     */
    function getEventPoint(event) {
        const zoneRect = logoDropZone.getBoundingClientRect();
        if (event.touches && event.touches[0]) {
            return {
                x: event.touches[0].clientX - zoneRect.left,
                y: event.touches[0].clientY - zoneRect.top
            };
        }

        return {
            x: event.clientX - zoneRect.left,
            y: event.clientY - zoneRect.top
        };
    }

    /**
     * Crops current source image by crop box and updates preview image.
     * Cropped output is saved as PNG data URL.
     */
    function cropCurrentModalImage() {
        if (!sourceImage || !imageDrawRect) {
            return;
        }

        const cropRect = getCropBoxRect();
        const scaleX = sourceImage.naturalWidth / imageDrawRect.width;
        const scaleY = sourceImage.naturalHeight / imageDrawRect.height;
        const sourceX = Math.round((cropRect.x - imageDrawRect.x) * scaleX);
        const sourceY = Math.round((cropRect.y - imageDrawRect.y) * scaleY);
        const sourceWidth = Math.round(cropRect.width * scaleX);
        const sourceHeight = Math.round(cropRect.height * scaleY);

        const cropCanvas = document.createElement("canvas");
        cropCanvas.width = sourceWidth;
        cropCanvas.height = sourceHeight;
        const cropCtx = cropCanvas.getContext("2d");
        cropCtx.drawImage(
            sourceImage,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            0,
            0,
            sourceWidth,
            sourceHeight
        );

        modalImageDataUrl = cropCanvas.toDataURL("image/png");
        const croppedImage = new Image();
        croppedImage.onload = function () {
            sourceImage = croppedImage;
            drawModalImage();
            resetCropBox();
        };
        croppedImage.src = modalImageDataUrl;
    }

    /**
     * Estimates localStorage byte usage for a string.
     * @param {string} value Input string.
     * @return {number} Approximate UTF-16 bytes.
     */
    function estimateStorageBytes(value) {
        return value.length * 2;
    }

    /**
     * Sums current localStorage usage for quota estimation.
     * @return {number} Approximate bytes used.
     */
    function getLocalStorageUsageBytes() {
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            const value = localStorage.getItem(key) || "";
            total += estimateStorageBytes(key);
            total += estimateStorageBytes(value);
        }
        return total;
    }

    return {
        openLogoModal: openLogoModal
    };
};
