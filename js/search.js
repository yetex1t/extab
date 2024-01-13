window.onload = function () {

	var searchInput = document.getElementById("searchtxt");
	var searchButton = document.getElementById("searchbtn");

	// 按 Tab 键聚焦搜索框
	document.onkeydown = function (event) {
		var ev = event || window.event;
		if (ev.key == "Tab") {
			searchInput.focus();
			return false;
		}
	}

	// 按 Enter 键开始搜索
	searchInput.onkeydown = function (event) {
		var ev = event || window.event;
		if (ev.key == "Enter") {
			if (searchInput.value != "") {
				window.location.href = `https://www.baidu.com/s?ie=utf-8&wd=${encodeURIComponent(searchInput.value)}`;
				searchInput.value = "";
			}
		}
	}

	// 点击图标进行搜索
	searchButton.onclick = function () {
		if (searchInput.value != "") {
			window.location.href = `https://www.baidu.com/s?ie=utf-8&wd=${encodeURIComponent(searchInput.value)}`;
			searchInput.value = "";
		}
	}
}