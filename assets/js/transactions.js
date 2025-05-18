// transactions js

import { getSession } from "./utils.js";
import { supabase } from "./supabaseClient.js";

const colors = [
	"#6c63ff",
	"#ff6f61",
	"#4caf50",
	"#2196f3",
	"#ffb74d",
	"#e91e63",
];

document.addEventListener("DOMContentLoaded", async () => {
	const searchInput = document.getElementById("userSearch");
	const tableBody = document.getElementById("balance-table-body");

	let allUsers = [];

	async function fetchProfiles() {
		const { data, error } = await supabase
			.from("profiles")
			.select("name, surname, credits");

		if (error) {
			console.error("❌ Error fetching profiles:", error.message);
			return;
		}

		allUsers = data;
		renderTable(); // show initial filtered data
	}

	function renderTable() {
		const query = searchInput.value.trim().toLowerCase();
		tableBody.innerHTML = "";

		const filtered = allUsers.filter((user) => {
			const fullName = `${user.name} ${user.surname}`.toLowerCase();
			const isNegative = user.credits < 0;
			const matches = fullName.includes(query);
			return query ? matches : isNegative;
		});

		filtered.forEach((user) => {
			const color = colors[Math.floor(Math.random() * colors.length)];
			const initials = user.name?.[0]?.toUpperCase() || "?";
			const fullName = `${user.name} ${user.surname}`;
			const isNegative = user.credits < 0;
			const statusClass = isNegative ? "negative" : "positive";

			const row = document.createElement("div");
			row.className = "user-row";
			row.dataset.name = fullName.toLowerCase();
			row.dataset.credit = user.credits;

			row.innerHTML = `
  <div class="user-avatar">
    <div class="table_avatar" style="background: ${color};">${initials}</div>
  </div>
  <div class="user-info">
    <span class="name-text">${fullName}</span>
   
  </div>
  <div class="user-icon">
    <i class="fas fa-cog"></i>
  </div>
`;

			tableBody.appendChild(row);
		});
	}

	searchInput.addEventListener("input", renderTable);
	await fetchProfiles();
});
