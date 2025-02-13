window.onload = function () {
    const searchInput = document.getElementById("searchtxt");
    const searchButton = document.getElementById("searchbtn");
    const searchLogo = document.getElementById("searchlogo");

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
    updateSearchLogo();

    // 监听回车键进行搜索
    searchInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            performSearch();
        }
    });

    // 监听搜索按钮点击进行搜索
    searchButton.addEventListener("click", performSearch);

    // 监听搜索 logo 点击切换搜索引擎
    searchLogo.addEventListener("click", switchSearchEngine);

    // 切换搜索引擎
    function switchSearchEngine() {
        currentEngineIndex = (currentEngineIndex + 1) % searchEngines.length; // 轮换引擎
        localStorage.setItem("searchEngine", searchEngines[currentEngineIndex]); // 存储用户选择
        updateSearchLogo(); // 更新图标
    }

    // 根据当前搜索引擎更新 logo
    function updateSearchLogo() {
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
    function performSearch() {
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
};
