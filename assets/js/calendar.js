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

export function renderCalendar() {
	calendarBody.innerHTML = "";

	const year = viewDate.getUTCFullYear();
	const month = viewDate.getUTCMonth();

	const firstDay = new Date(Date.UTC(year, month, 1));
	const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

	// ✅ Shift to Monday-start (JS: 0=Sun → 6, 1=Mon → 0, etc.)
	const rawOffset = firstDay.getUTCDay();
	const startOffset = (rawOffset + 6) % 7;

	// Fill leading empty cells
	for (let i = 0; i < startOffset; i++) {
		const empty = document.createElement("div");
		empty.className = "day-cell empty";
		calendarBody.appendChild(empty);
	}

	for (let day = 1; day <= daysInMonth; day++) {
		const cell = document.createElement("div");
		cell.className = "day-cell";

		const dateObj = new Date(Date.UTC(year, month, day));
		const dateStr = formatDate(dateObj); // should also be UTC-safe

		// Debug log to ensure correct mapping
		console.log(`📅 ${dateStr} → weekday index ${dateObj.getUTCDay()}`);

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

		cell.addEventListener("click", () => {
			selectedDate = dateStr;
			renderCalendar();
			renderAgenda(dateStr);
		});
	}
}

export async function loadCalendar(classes, bookings = []) {
	allClasses = classes;
	groupedByDate = groupClassesByDate(allClasses);
	userBookings = bookings;
	updateMonthLabel();
	renderCalendar();
}

export function goToNextMonth() {
	viewDate.setMonth(viewDate.getMonth() + 1);
	updateMonthLabel();
	renderCalendar();
}

export function goToPrevMonth() {
	viewDate.setMonth(viewDate.getMonth() - 1);
	updateMonthLabel();
	renderCalendar();
}

// Connect buttons to navigation
document.getElementById("next-month").addEventListener("click", goToNextMonth);
document.getElementById("prev-month").addEventListener("click", goToPrevMonth);

// Load calendar with class data
(async () => {
	const session = await getSession();
	const userId = session?.user?.id;

	const bookings = userId ? await getUserBookings(userId) : [];

	const classes = await getAvailableClasses();

	const sorted = classes.sort((a, b) => a.date.localeCompare(b.date));
	populateClassFilter(sorted);

	loadCalendar(sorted, bookings);
})();

let sorted = [];
let bookings = [];

document.getElementById("class-filter").addEventListener("change", () => {
	renderCalendar();
});
