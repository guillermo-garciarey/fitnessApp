import { getSession, showToast } from "./utils.js";
import { supabase } from "./supabaseClient.js";

const colors = [
	"#6c63ff",
	"#ff6f61",
	"#4caf50",
	"#2196f3",
	"#ffb74d",
	"#e91e63",
];

let selectedUserId = null;
let allUsers = [];
let searchInput;
let tableBody;

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
		const credits = user.credits;
		const creditClass = credits < 0 ? "credit-text negative" : "credit-text";

		const row = document.createElement("div");
		row.className = "user-row";
		row.dataset.userid = user.id;
		row.dataset.username = fullName;
		row.dataset.credit = user.credits;

		row.innerHTML = `
        <div class="user-avatar">
          <div class="table_avatar" style="background: ${color};">${initials}</div>
        </div>
        <div class="user-info">
          <span class="name-text">${fullName}</span>
        </div>
		<div class="user-info">
          <span class="${creditClass}">${credits}</span>
        </div>
      `;

		tableBody.appendChild(row);
	});
}

async function fetchProfiles() {
	const { data, error } = await supabase
		.from("profiles")
		.select("id, name, surname, credits");

	if (error) {
		console.error("❌ Error fetching profiles:", error.message);
		return;
	}

	allUsers = data;
	renderTable();
}

document.addEventListener("DOMContentLoaded", async () => {
	searchInput = document.getElementById("userSearch");
	tableBody = document.getElementById("balance-table-body");

	await fetchProfiles();

	// ✅ Click to select a user and populate the top-up form
	tableBody.addEventListener("click", (e) => {
		const row = e.target.closest(".user-row");
		if (!row) return;

		document.querySelectorAll(".user-row").forEach((el) => {
			el.classList.remove("selected");
		});

		row.classList.add("selected");
		selectedUserId = row.dataset.userid;

		const nameEl = document.getElementById("selected-username");
		if (nameEl) nameEl.textContent = row.dataset.username;
		// ✅ Scroll to top-up form
		const topupForm = document.querySelector(".admin-topup-form");
		topupForm?.scrollIntoView({ behavior: "smooth", block: "start" });
	});

	searchInput.addEventListener("input", renderTable);
});

// Track credit value and method
let creditValue = 1;
let selectedPaymentMethod = null;

const creditDisplay = document.getElementById("credit-value");

const methodCards = document.querySelectorAll(".method-card");
const confirmBtn = document.getElementById("confirm-topup");
const resetBtn = document.getElementById("reset-form");
const manualCheckbox = document.getElementById("manual-checkbox");

// Payment method selection
methodCards.forEach((card) => {
	card.addEventListener("click", () => {
		methodCards.forEach((c) => c.classList.remove("selected"));
		card.classList.add("selected");
		selectedPaymentMethod = card.dataset.method;
	});
});

confirmBtn.addEventListener("click", async () => {
	const creditInput = document.getElementById("credit-value");
	const amountInput = document.getElementById("amount-value");

	const credits = parseInt(creditInput?.value, 10);
	const amount = parseInt(amountInput?.value, 10);

	if (!selectedUserId) {
		showToast("Please select a user.", "error");
		return;
	}

	if (!selectedPaymentMethod) {
		showToast("Please select a payment method.", "error");
		return;
	}

	// ✅ Call Supabase RPC
	const { error } = await supabase.rpc("admin_topup", {
		user_id: selectedUserId,
		credits,
		amount,
		payment_method: selectedPaymentMethod,
		reason:
			selectedPaymentMethod === "Manual Correction"
				? "Manual Correction"
				: "Subscription",
	});

	if (error) {
		console.error("❌ Payment failed:", error.message);
		showToast("Failed to add payment. Try again.", "error");
		return;
	}

	// ✅ Success
	showToast("✅ Payment added successfully!", "success");
	resetTopupForm();
	await fetchProfiles();
	document.getElementById("main")?.scrollTo({
		top: 0,
		behavior: "smooth",
	});
});

// Reset form
function resetTopupForm() {
	document.getElementById("credit-value").value = "1";
	document.getElementById("amount-value").value = "1";
	selectedPaymentMethod = null;
	methodCards.forEach((c) => c.classList.remove("selected"));
}

resetBtn.addEventListener("click", resetTopupForm);
