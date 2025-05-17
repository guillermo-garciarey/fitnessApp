// calendar.js

import { groupClassesByDate, getAvailableClasses } from "./utils.js";

let viewDate = new Date();
let selectedDate = null;
let allClasses = [];
let groupedByDate = {};

const calendarBody = document.getElementById("calendar");
const monthLabel = document.getElementById("month-label");

function formatDate(date) {
	return date.toISOString().split("T")[0];
}

function updateMonthLabel() {
	const options = { year: "numeric", month: "long" };
	monthLabel.textContent = viewDate.toLocaleDateString("en-US", options);
}

function renderCalendar() {
	calendarBody.innerHTML = "";

	const year = viewDate.getFullYear();
	const month = viewDate.getMonth();
	const firstDay = new Date(year, month, 1);
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	// Shift so Monday = 0, Sunday = 6
	const rawOffset = firstDay.getDay(); // 0 = Sunday
	const startOffset = (rawOffset + 5) % 7;

	for (let i = 0; i < startOffset; i++) {
		const empty = document.createElement("div");
		empty.className = "day-cell empty";
		calendarBody.appendChild(empty);
	}

	for (let day = 1; day <= daysInMonth; day++) {
		const cell = document.createElement("div");
		cell.className = "day-cell";

		const dateObj = new Date(year, month, day);
		const dateStr = formatDate(dateObj);

		cell.innerHTML = `<div class="day-number">${day}</div>`;

		const classes = groupedByDate[dateStr] || [];
		classes.forEach((cls) => {
			const dot = document.createElement("div");
			dot.className = "dot";
			dot.title = `${cls.name} @ ${cls.time}`;
			cell.appendChild(dot);
		});

		cell.addEventListener("click", () => {
			selectedDate = dateStr;
			renderCalendar();
			// Optional: renderAgenda()
		});

		if (dateStr === selectedDate) cell.classList.add("selected");

		calendarBody.appendChild(cell);
	}
}

// Connect buttons to navigation
document.getElementById("next-month").addEventListener("click", goToNextMonth);
document.getElementById("prev-month").addEventListener("click", goToPrevMonth);
// Optional: today button
// document.getElementById("today-btn").addEventListener("click", goToToday);

// Load calendar with class data
(async () => {
	const classes = await getAvailableClasses();

	// Make sure your classes include a .date (YYYY-MM-DD) and .time field
	// Optional: sort them if needed
	const sorted = classes.sort((a, b) => a.date.localeCompare(b.date));

	loadCalendar(sorted);
})();

export async function loadCalendar(classes) {
	allClasses = classes;
	groupedByDate = groupClassesByDate(allClasses);
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

export function goToToday() {
	viewDate = new Date();
	selectedDate = formatDate(viewDate);
	updateMonthLabel();
	renderCalendar();
}
