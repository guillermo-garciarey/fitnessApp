// calendar.js

import { supabase } from "./supabaseClient.js";

import {
	getSession,
	getUserProfile,
	getUserBookings,
	getAvailableClasses,
	isClassBooked,
	groupClassesByDate,
	showToast,
	confirmAction,
	formatDate,
	getUserRole,
} from "./utils.js";

import { renderAgenda, fetchUserRole, internalUserRole } from "./agenda.js";

let viewDate = new Date();
let selectedDate = formatDate(new Date());
let allClasses = [];
export let selectedFilter = null;
export let userBookings = [];
export let groupedByDate = {};

export function setGroupedByDate(newData) {
	groupedByDate = newData;
}

const calendarBody = document.getElementById("calendar");
const monthLabel = document.getElementById("month-label");

function updateMonthLabel() {
	const options = { year: "numeric", month: "long" };
	monthLabel.textContent = viewDate.toLocaleDateString("en-US", options);
}

export function populateClassFilter(classList) {
	const filterList = document.getElementById("filter-options");

	// Remove all existing filter options
	filterList.innerHTML = "";

	const uniqueNames = [...new Set(classList.map((cls) => cls.name))]
		.filter(Boolean)
		.sort((a, b) => a.localeCompare(b));

	uniqueNames.forEach((name) => {
		const li = document.createElement("li");
		li.dataset.value = name;
		li.textContent = name;
		filterList.appendChild(li);
	});
}

// Caching mechanism
const loadedMonths = new Set(); // e.g. "2025-05"
export const classCache = {}; // { "2025-05": [ ...classes ] }

// Format YYYY-MM string
function getMonthKey(date) {
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
		2,
		"0"
	)}`;
}

// Fetch classes for a given month if not already loaded
async function fetchClassesForMonth(date) {
	const key = getMonthKey(date);
	if (loadedMonths.has(key)) return;

	const year = date.getUTCFullYear();
	const month = date.getUTCMonth();

	const firstDay = `${key}-01`;
	const lastDay = new Date(Date.UTC(year, month + 1, 0))
		.toISOString()
		.split("T")[0];

	const { data, error } = await supabase
		.from("classes")
		.select("id, name, date, time, description, booked_slots, capacity")
		.gte("date", firstDay)
		.lte("date", lastDay);

	if (error) {
		console.error(`❌ Failed to fetch classes for ${key}:`, error.message);
		return;
	}

	classCache[key] = data;
	loadedMonths.add(key);

	// Flatten all months to update global state
	allClasses = Object.values(classCache).flat();
	groupedByDate = groupClassesByDate(allClasses);
}

export async function renderCalendar() {
	calendarBody.innerHTML = "";

	const year = viewDate.getUTCFullYear();
	const month = viewDate.getUTCMonth();

	const viewMonthDate = new Date(Date.UTC(year, month, 1));
	await fetchClassesForMonth(viewMonthDate);

	const firstDay = new Date(Date.UTC(year, month, 1));
	const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
	const rawOffset = firstDay.getUTCDay();
	const startOffset = (rawOffset + 6) % 7;

	for (let i = 0; i < startOffset; i++) {
		const empty = document.createElement("div");
		empty.className = "day-cell empty";
		calendarBody.appendChild(empty);
	}

	for (let day = 1; day <= daysInMonth; day++) {
		const cell = document.createElement("div");
		cell.className = "day-cell";

		const dateObj = new Date(Date.UTC(year, month, day));
		const dateStr = formatDate(dateObj);
		cell.dataset.date = dateStr;

		const number = document.createElement("div");
		number.className = "day-number";
		number.textContent = day;
		cell.appendChild(number);

		const classes = groupedByDate[dateStr] || [];
		if (classes.length === 0) {
			cell.classList.add("no-classes");
		}

		let showDot = false;

		if (getUserRole() === "admin") {
			// ✅ Admin sees a dot if any class has at least 1 booking
			showDot = classes.some((cls) => cls.booked_slots > 0);
		} else {
			// 👤 Users see dot based on their bookings or selected filter
			showDot = selectedFilter
				? classes.some((cls) => cls.name === selectedFilter)
				: false;
		}

		if (showDot) {
			const dot = document.createElement("div");
			dot.classList.add("dot", "green-dot");
			cell.appendChild(dot);
		}

		if (dateStr === selectedDate) {
			cell.classList.add("selected");
		}

		calendarBody.appendChild(cell);

		cell.addEventListener("click", async () => {
			selectedDate = dateStr;
			await renderCalendar();
			await renderAgenda(dateStr);

			const element = document.querySelector(".altsection");

			element.scrollIntoView({
				behavior: "smooth",
				block: "start",
			});
		});
	}
}

// Chevron calendar

export async function loadCalendar(bookings = []) {
	const now = new Date();
	await fetchClassesForMonth(now);

	allClasses = Object.values(classCache).flat();
	groupedByDate = groupClassesByDate(allClasses);

	// ✅ Defensive fix: ensure all values are class IDs
	userBookings = bookings
		.map((b) => (typeof b === "object" && b?.class_id ? b.class_id : b))
		.filter(Boolean);

	updateMonthLabel();
	await renderCalendar();
}

export async function goToNextMonth() {
	viewDate.setMonth(viewDate.getMonth() + 1);
	updateMonthLabel();
	await renderCalendar();
}

export async function goToPrevMonth() {
	viewDate.setMonth(viewDate.getMonth() - 1);
	updateMonthLabel();
	await renderCalendar();
}

// Month nav buttons
document.getElementById("next-month").addEventListener("click", async () => {
	await goToNextMonth();
});
document.getElementById("prev-month").addEventListener("click", async () => {
	await goToPrevMonth();
});

// Dropdown filter

const filterButton = document.getElementById("filter-button");
const filterOptions = document.getElementById("filter-options");

filterButton.addEventListener("click", () => {
	filterOptions.classList.toggle("hidden");
});

filterOptions.addEventListener("click", async (e) => {
	const value = e.target.dataset.value;
	if (!value) return;

	selectedFilter = value;
	filterButton.textContent = `${e.target.textContent}`;
	filterOptions.classList.add("hidden");

	await renderCalendar();
	await renderAgenda(selectedDate);
	// window.scrollTo({ top: 0, behavior: "smooth" });
	const targetSection = document.querySelector(".mainsection");
	targetSection?.scrollIntoView({ behavior: "smooth", block: "start" });
});

document.addEventListener("click", (e) => {
	const dropdown = document.getElementById("filter-options");
	const button = document.getElementById("filter-button");

	const isDropdownOpen = !dropdown.classList.contains("hidden");
	const clickedInsideDropdown = dropdown.contains(e.target);
	const clickedButton = button.contains(e.target);

	// If dropdown is not open, do nothing
	if (!isDropdownOpen) return;

	// If click is outside both the button and the dropdown, close it
	if (!clickedInsideDropdown && !clickedButton) {
		dropdown.classList.add("hidden");
	}
});

(async () => {
	setTimeout(() => {
		document.getElementById("app-loader")?.classList.add("hide");
	}, 2500);
	const session = await getSession();
	const userId = session?.user?.id;

	const bookings = userId ? await getUserBookings(userId) : [];

	await loadCalendar(bookings); // ✅ load current month + bookings

	// ✅ Populate filter based on the classes for the loaded month
	const initialMonthKey = `${viewDate.getUTCFullYear()}-${String(
		viewDate.getUTCMonth() + 1
	).padStart(2, "0")}`;
	const initialClasses = classCache[initialMonthKey] || [];

	populateClassFilter(initialClasses);
})();

// Refresh calendar slots without rendering calendar again

export function refreshCalendarDots() {
	cells.forEach((cell) => {
		const dateStr = cell.dataset.date;
		const classes = groupedByDate[dateStr] || [];

		console.log(`📅 ${dateStr}: ${classes.length} classes`);

		// Remove existing dots
		cell.querySelectorAll(".dot").forEach((dot) => dot.remove());

		let showDot = false;

		for (const cls of classes) {
			console.log("🆔 Class:", cls.id, "Booked slots:", cls.booked_slots);

			if (getUserRole() === "admin") {
				if (cls.booked_slots > 0) {
					showDot = true;
					break;
				}
			}

			if (selectedFilter && cls.name === selectedFilter) {
				showDot = true;
				break;
			}
		}

		if (showDot) {
			const dot = document.createElement("div");
			dot.classList.add("dot");

			if (getUserRole() === "admin") {
				dot.classList.add("admin-dot");
			} else {
				dot.classList.add("green-dot");
			}

			cell.appendChild(dot);
			console.log(`✅ Dot added for ${dateStr}`);
		} else {
			console.log(`🚫 No dot for ${dateStr}`);
		}
	});
}

export async function updateCalendarDots(userId) {
	const now = new Date();

	await forceRefreshClassesForMonth(now);

	if (getUserRole() !== "admin") {
		userBookings = await getUserBookings(userId);
	} else {
	}

	refreshCalendarDots();
}

export async function refreshCalendarAfterAdminAction() {
	const now = new Date();
	const key = getMonthKey(now);

	// ❌ Remove old cache entry to force fresh fetch
	loadedMonths.delete(key);

	// 🔁 Re-fetch and update global class list
	await fetchClassesForMonth(now);

	allClasses = Object.values(classCache).flat();
	groupedByDate = groupClassesByDate(allClasses);

	// ✅ Refresh the visible dots using updated data
	refreshCalendarDots();
}

// Force Refresh even if classes are already loaded

export async function forceRefreshClassesForMonth(date) {
	const key = getMonthKey(date);

	// 🔁 Remove the cache so the month gets re-fetched
	loadedMonths.delete(key);
	delete classCache[key];

	console.log(`♻️ Forcing refetch for month ${key}`);

	await fetchClassesForMonth(date);
}

//
