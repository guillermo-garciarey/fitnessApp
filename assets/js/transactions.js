document.addEventListener("DOMContentLoaded", () => {
	const searchInput = document.getElementById("userSearch");
	const rows = document.querySelectorAll("#balance-table-body tr");

	function updateTable() {
		const query = searchInput.value.trim().toLowerCase();

		rows.forEach((row) => {
			const name = row.dataset.name.toLowerCase();
			const credit = parseInt(row.dataset.credit, 10);
			const matchesSearch = name.includes(query);
			const isNegative = credit < 0;

			const shouldShow = query ? matchesSearch : isNegative;

			row.style.display = shouldShow ? "" : "none";
		});
	}

	searchInput.addEventListener("input", updateTable);
	updateTable(); // initial render
});
