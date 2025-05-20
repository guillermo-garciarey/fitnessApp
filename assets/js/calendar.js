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
} from "./utils.js";

import { renderAgenda, fetchUserRole } from "./agenda.js";

let viewDate = new Date();
let selectedDate = formatDate(new Date());
let allClasses = [];
let groupedByDate = {};
let userBookings = [];

const calendarBody = document.getElementById("calendar");
const monthLabel = document.getElementById("month-label");

function updateMonthLabel() {
	const options = { year: "numeric", month: "long" };
	monthLabel.textContent = viewDate.toLocaleDateString("en-US", options);
}

function populateClassFilter(classList) {
	const filter = document.getElementById("class-filter");
	const uniqueNames = [...new Set(classList.map((cls) => cls.name))]
		.filter(Boolean)
		.sort((a, b) => a.localeCompare(b));

	// Clear previous options except "My Bookings"
	filter
		.querySelectorAll("option:not([value='bookings'])")
		.forEach((opt) => opt.remove());

	uniqueNames.forEach((name) => {
		const opt = document.createElement("option");
		opt.value = name;
		opt.textContent = name;
		filter.appendChild(opt);
	});
}

// Caching mechanism
const loadedMonths = new Set(); // e.g. "2025-05"
const classCache = {}; // { "2025-05": [ ...classes ] }

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
	await fetchClassesForMonth(viewMonthDate); // Ensure this month is loaded

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

		const number = document.createElement("div");
		number.className = "day-number";
		number.textContent = day;
		cell.appendChild(number);

		const classes = groupedByDate[dateStr] || [];
		if (classes.length === 0) {
			cell.classList.add("no-classes");
		}

		const selectedFilter = document.getElementById("class-filter").value;
		let showGreenDot = false;

		classes.forEach((cls) => {
			if (selectedFilter === "bookings" && userBookings.includes(cls.id)) {
				showGreenDot = true;
			}
			if (selectedFilter !== "bookings" && cls.name === selectedFilter) {
				showGreenDot = true;
			}
		});

		if (showGreenDot) {
			const greenDot = document.createElement("div");
			greenDot.classList.add("dot", "green-dot");
			cell.appendChild(greenDot);
		}

		if (dateStr === selectedDate) {
			cell.classList.add("selected");
		}

		calendarBody.appendChild(cell);

		cell.addEventListener("click", async () => {
			selectedDate = dateStr;
			await renderCalendar();
			renderAgenda(dateStr);
		});
	}
}

export async function loadCalendar(bookings = []) {
	const now = new Date();
	await fetchClassesForMonth(now); // Only initial month
	userBookings = bookings;
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

document.getElementById("class-filter").addEventListener("change", async () => {
	await renderCalendar();
});

(async () => {
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
