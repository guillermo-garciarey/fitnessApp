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
export let userBookings = [];
export let groupedByDate = {};

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

	// ✅ Re-label the "bookings" option
	const bookingsOption = filter.querySelector("option[value='bookings']");
	if (bookingsOption) bookingsOption.textContent = "My Bookings";

	// Add all unique class names
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
		const selectedFilter =
			document.getElementById("class-filter")?.value ?? "bookings";

		if (userRole === "admin") {
			// ✅ Admin sees a dot if any class has at least 1 booking
			showDot = classes.some((cls) => cls.booked_slots > 0);
		} else {
			// 👤 Users see dot based on their bookings or selected filter
			showDot = classes.some((cls) => {
				if (selectedFilter === "bookings") {
					return userBookings.includes(cls.id);
				}
				return cls.name === selectedFilter;
			});
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

			const agendaEl = document.querySelector(".agenda-container");
			if (agendaEl) {
				agendaEl.scrollIntoView({ behavior: "smooth", block: "start" });
			}
		});
	}
}

// Chevron calendar

document.getElementById("next-section").addEventListener("click", async () => {
	const agendaEl = document.querySelector(".agenda-container");
	if (agendaEl) {
		agendaEl.scrollIntoView({ behavior: "smooth", block: "start" });
	}
});

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

document.getElementById("class-filter").addEventListener("change", async () => {
	await renderCalendar();
});

(async () => {
	setTimeout(() => {
		document.getElementById("app-loader")?.classList.add("hide");
	}, 3500);
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

import { userRole } from "./agenda.js"; // ✅ Make sure this import exists at the top

export function refreshCalendarDots() {
	const selectedFilter =
		document.getElementById("class-filter")?.value ?? "bookings";

	const cells = document.querySelectorAll(".day-cell:not(.empty)");

	cells.forEach((cell) => {
		const dateStr = cell.dataset.date;
		const classes = groupedByDate[dateStr] || [];

		// Remove existing dots
		cell.querySelectorAll(".dot").forEach((dot) => dot.remove());

		let showDot = false;

		for (const cls of classes) {
			if (userRole === "admin") {
				// ✅ Admin sees a dot for *any* class on the day
				showDot = true;
				break;
			}

			// ✅ Normal user logic
			if (
				(selectedFilter === "bookings" && userBookings.includes(cls.id)) ||
				(selectedFilter !== "bookings" && cls.name === selectedFilter)
			) {
				showDot = true;
				break;
			}
		}

		if (showDot) {
			const dot = document.createElement("div");
			dot.classList.add("dot");

			if (userRole === "admin") {
				dot.classList.add("admin-dot");
			} else {
				dot.classList.add("green-dot");
			}

			cell.appendChild(dot);
		}
	});
}

export async function updateCalendarDots(userId) {
	userBookings = await getUserBookings(userId);
	groupedByDate = groupClassesByDate(allClasses);
	refreshCalendarDots();
}
