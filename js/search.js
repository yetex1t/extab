window.onload = function () {
    // 获取搜索输入框和搜索按钮
    const searchInput = document.getElementById("searchtxt");
    const searchButton = document.getElementById("searchbtn");

    // 按 Enter 键开始搜索
    searchInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            performSearch();
        }
    });

    // 点击图标进行搜索
    searchButton.addEventListener('click', performSearch);

    // 执行搜索操作
    function performSearch() {
        const query = searchInput.value.trim();
        if (query !== '') {
            window.location.href = `https://www.baidu.com/s?ie=utf-8&wd=${encodeURIComponent(query)}`;
            searchInput.value = '';
        }
    }
};