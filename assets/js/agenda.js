// agenda.js

import { getSession, getUserBookings } from "./utils.js";

let allClasses = [];
let userBookings = [];
let selectedDate = getLocalDateStr();
console.log("Agenda script loaded");

function getLocalDateStr(date = new Date()) {
	return date.toLocaleDateString("sv-SE"); // "sv-SE" = YYYY-MM-DD format
}

export function setAgendaData(classes, bookings) {
	allClasses = classes;
	userBookings = bookings;
}

export function renderAgenda(dateStr) {
	selectedDate = dateStr;
	const agendaContainer = document.getElementById("agenda");
	agendaContainer.innerHTML = "";

	const dayClasses = allClasses.filter((cls) => cls.date === selectedDate);
	const sortedClasses = dayClasses.sort((a, b) => a.time.localeCompare(b.time));

	if (sortedClasses.length === 0) {
		agendaContainer.innerHTML = `<p class="no-classes-msg">No classes on this day.</p>`;
		return;
	}

	const selectedFilter = document.getElementById("class-filter").value;

	sortedClasses.forEach((cls) => {
		const card = document.createElement("div");
		card.className = "agenda-card";

		const timeFormatted = new Date(`1970-01-01T${cls.time}`).toLocaleTimeString(
			[],
			{
				hour: "numeric",
				minute: "2-digit",
				hour12: true,
			}
		);

		// ✅ Define logic first
		const isBooked = userBookings.includes(cls.id);
		const isMatch =
			selectedFilter !== "bookings" && cls.name === selectedFilter;

		// ✅ Create dot element and apply correct color
		const dot = document.createElement("span");
		dot.classList.add("agenda-dot");

		if (isBooked) {
			dot.style.background = "var(--color-green-300)";
		} else if (isMatch) {
			dot.style.background = "var(--color-amber-400)";
		} else {
			dot.style.background = "var(--gray-900)";
		}

		// ✅ Fill in HTML
		card.innerHTML = `
			<div class="agenda-card-header"></div>
			${
				cls.description
					? `<div class="agenda-description">${cls.description}</div>`
					: ""
			}
			<div class="agenda-participants">${cls.booked_slots} / ${
			cls.capacity
		} participants</div>
		`;

		// ✅ Append dot, name, and time
		const header = card.querySelector(".agenda-card-header");
		header.appendChild(dot);

		const nameEl = document.createElement("span");
		nameEl.className = "agenda-name";
		nameEl.textContent = cls.name;
		header.appendChild(nameEl);

		const timeEl = document.createElement("span");
		timeEl.className = "agenda-time";
		timeEl.textContent = timeFormatted;
		header.appendChild(timeEl);

		agendaContainer.appendChild(card);
	});
}

(async () => {
	const session = await getSession();
	const userId = session?.user?.id;
	if (!userId) return;

	const { getAvailableClasses } = await import("./utils.js");
	const classes = await getAvailableClasses();
	const bookings = await getUserBookings(userId);

	setAgendaData(classes, bookings);
	renderAgenda(selectedDate);
})();
