window.onload = function () {
    const searchInput = document.getElementById("search-input");
    const searchButton = document.getElementById("search-button");
    const searchLogo = document.getElementById("search-logo");

    // 可选搜索引擎列表
    let searchEngines = ["baidu", "google", "bing"];
    let currentEngineIndex = 0;

    // 读取本地存储的搜索引擎
    if (localStorage.getItem("searchEngine")) {
        currentEngineIndex = searchEngines.indexOf(
            localStorage.getItem("searchEngine")
        );
        if (currentEngineIndex === -1) currentEngineIndex = 0;
    }

    // 更新搜索引擎图标
    UpdateSearchLogo();

    // 监听回车键进行搜索
    searchInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            PerformSearch();
        }
    });

    // 监听搜索按钮点击进行搜索
    searchButton.addEventListener("click", PerformSearch);

    // 监听搜索 logo 点击切换搜索引擎
    searchLogo.addEventListener("click", SwitchSearchEngine);

    // 切换搜索引擎
    function SwitchSearchEngine() {
        currentEngineIndex = (currentEngineIndex + 1) % searchEngines.length; // 轮换引擎
        localStorage.setItem("searchEngine", searchEngines[currentEngineIndex]); // 存储用户选择
        UpdateSearchLogo(); // 更新图标
    }

    // 根据当前搜索引擎更新 logo
    function UpdateSearchLogo() {
        let engine = searchEngines[currentEngineIndex];
        if (engine === "baidu") {
            searchLogo.style.backgroundImage = "url('../img/baidu.png')";
        } else if (engine === "google") {
            searchLogo.style.backgroundImage = "url('../img/google.png')";
        } else if (engine === "bing") {
            searchLogo.style.backgroundImage = "url('../img/bing.png')";
        }
    }

    // 执行搜索
    function PerformSearch() {
        const query = searchInput.value.trim();
        if (query !== "") {
            let searchURL = "";
            let engine = searchEngines[currentEngineIndex];

            // 根据当前搜索引擎构造搜索 URL
            if (engine === "baidu") {
                searchURL = `https://www.baidu.com/s?ie=utf-8&wd=${encodeURIComponent(
                    query
                )}`;
            } else if (engine === "google") {
                searchURL = `https://www.google.com/search?q=${encodeURIComponent(
                    query
                )}`;
            } else if (engine === "bing") {
                searchURL = `https://www.bing.com/search?q=${encodeURIComponent(
                    query
                )}`;
            }

            window.location.href = searchURL; // 跳转到搜索页面
            searchInput.value = ""; // 清空输入框
        }
    }

    // 获取按钮元素
    const toggleButton = document.getElementById("toggle-button");

    // 保存主题状态
    if (localStorage.getItem("theme") === "dark") {
        document.body.classList.add("dark-mode");
        toggleButton.innerHTML = '<img src="../img/sun.png" width="24">';
    }

    // 切换暗黑模式
    toggleButton.addEventListener("click", function () {
        document.body.classList.toggle("dark-mode");
        const isDark = document.body.classList.contains("dark-mode");

        // 切换按钮图标
        this.innerHTML = isDark
            ? '<img src="../img/sun.png" width="24">'
            : '<img src="../img/moon.png" width="24">';
        localStorage.setItem("theme", isDark ? "dark" : "light");
    });
};
