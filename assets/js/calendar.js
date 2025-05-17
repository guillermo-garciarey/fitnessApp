// calendar.js

import {
	getSession,
	getUserProfile,
	getUserBookings,
	getAvailableClasses,
	isClassBooked,
	groupClassesByDate,
} from "./utils.js";

let viewDate = new Date();
let selectedDate = null;
let allClasses = [];
let groupedByDate = {};
let userBookings = [];

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

		const number = document.createElement("div");
		number.className = "day-number";
		number.textContent = day;
		cell.appendChild(number);

		const classes = groupedByDate[dateStr] || [];

		let hasBooking = false;
		let hasOtherClass = false;

		// Sets a flag for user bookings, filter classes or no classes
		if (classes.length === 0) {
			cell.classList.add("no-classes");
		}
		classes.forEach((cls) => {
			if (userBookings.includes(cls.id)) {
				hasBooking = true;
			} else {
				hasOtherClass = true;
			}
		});

		// First, green dot for booking

		if (hasOtherClass) {
			console.log("No bookings on", dateStr); // ✅ check this
			const amberDot = document.createElement("div");
			amberDot.classList.add("dot", "amber-dot");
			cell.appendChild(amberDot);
		}
		if (hasBooking) {
			console.log("Booking on", dateStr); // ✅ check this
			const greenDot = document.createElement("div");
			greenDot.classList.add("dot", "green-dot");
			cell.appendChild(greenDot);
		}

		cell.addEventListener("click", () => {
			selectedDate = dateStr;
			renderCalendar();
			// Optional: renderAgenda()
		});

		if (dateStr === selectedDate) cell.classList.add("selected");

		calendarBody.appendChild(cell);
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
	console.log("Bookings:", bookings); // should be array of class IDs

	const classes = await getAvailableClasses();
	console.log("Classes:", classes); // should include { id, date, time, etc. }

	const sorted = classes.sort((a, b) => a.date.localeCompare(b.date));

	loadCalendar(sorted, bookings);
})();
