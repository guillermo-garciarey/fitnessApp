// agenda.js

import { supabase } from "./supabaseClient.js";

import {
	getSession,
	getUserBookings,
	showToast,
	confirmAction,
	getAvailableClasses,
	formatDate,
	groupClassesByDate,
	withSpinner,
	showSuccessToast,
	showErrorToast,
} from "./utils.js";

import {
	loadCalendar,
	renderCalendar,
	refreshCalendarDots,
	updateCalendarDots,
	userBookings,
	groupedByDate,
	setGroupedByDate,
	selectedFilter,
} from "./calendar.js";

import { openAdminModal } from "./admin.js";

let allClasses = [];
export let selectedDate = getLocalDateStr();
let agendaClickListenerAttached = false;

export let internalUserRole = "user";
export function getUserRole() {
	return internalUserRole;
}

export function getLocalDateStr(date = new Date()) {
	return date.toLocaleDateString("sv-SE"); // "sv-SE" = YYYY-MM-DD format
}

export async function fetchUserRole() {
	const session = await getSession();
	const userId = session?.user?.id;
	if (!userId) {
		console.warn("❌ No user session found");
		return;
	}

	const { data, error } = await supabase
		.from("profiles")
		.select("role")
		.eq("id", userId)
		.single();

	if (error) {
		console.error("❌ Failed to fetch user role from profiles:", error.message);
		return;
	}

	internalUserRole = data.role || "user";
	console.log("👤 Role from profiles table:", internalUserRole);
}

export function setAgendaData(classes) {
	allClasses = classes;
}

export async function renderAgenda(dateStr) {
	console.log("Rendering agenda for:", dateStr);
	selectedDate = dateStr;
	const agendaContainer = document.getElementById("agenda");
	agendaContainer.innerHTML = "";

	const { data: latest, error } = await supabase
		.from("classes")
		.select("*")
		.eq("date", selectedDate);

	if (error || !latest) {
		console.error("❌ Failed to fetch latest classes:", error?.message);
		agendaContainer.innerHTML =
			'<p class="error-msg">Could not load classes. Try again later.</p>';
		return;
	}

	allClasses = allClasses
		.filter((cls) => cls.date !== selectedDate)
		.concat(latest);

	setGroupedByDate(groupClassesByDate(allClasses));

	const dayClasses = groupedByDate[selectedDate] || [];
	const sortedClasses = dayClasses.sort((a, b) => a.time.localeCompare(b.time));

	if (sortedClasses.length === 0) {
		agendaContainer.innerHTML = `<p class="no-classes-msg">No classes on this day.</p>`;
		return;
	}

	console.log("📦 selectedFilter from calendar.js:", selectedFilter);

	sortedClasses.forEach((cls) => {
		const card = document.createElement("div");
		card.className = "agendacard2";
		card.dataset.id = cls.id;

		const classDateTime = new Date(`${cls.date}T${cls.time}`);
		const now = new Date();

		if (classDateTime < now) {
			card.classList.add("expired-class");
		}

		const timeFormatted = new Date(`1970-01-01T${cls.time}`).toLocaleTimeString(
			[],
			{
				hour: "numeric",
				minute: "2-digit",
				hour12: true,
			}
		);

		const isBooked = userBookings.includes(cls.id);

		if (isBooked) {
			card.classList.add("has-booking");
		}
		const isMatch =
			internalUserRole === "admin" ||
			selectedFilter === "all" ||
			cls.name === selectedFilter;

		const dot = document.createElement("span");
		dot.classList.add("agenda-dot");

		if (internalUserRole === "admin") {
			if (cls.booked_slots > 0) {
				card.classList.add("matches-filter");
				dot.style.background = "var(--warning-500)";
			} else {
				card.classList.add("matches-filter");
				dot.style.background = "var(--text2)";
			}
		} else {
			if (isBooked) {
				dot.style.background = "var(--success-500)";
			} else if (isMatch) {
				card.classList.add("matches-filter");
			} else {
				dot.style.background = "var(--text2)";
			}
		}

		const slotsAvailable = cls.capacity - cls.booked_slots;
		const isFull = slotsAvailable < 1;
		if (slotsAvailable > 1) {
			card.classList.add("class-has-slots");
		}

		card.innerHTML = `
			<div class="cardpic">
				<img src="${cls.image_url || "images/classes/default.webp"}" alt="${
			cls.name
		}" />
			</div>
			<div class="cardcontent">
				<h3>${cls.name} ${
			cls.description
				? `<span id="description"> - ${cls.description}</span>`
				: ""
		}</h3>
				<div class="carddeets">
					<p class="time">${timeFormatted}</p>
					<p class="slots ${isFull ? "overbooked" : ""}">
						${slotsAvailable} slot${slotsAvailable !== 1 ? "s" : ""} available
						${isFull ? `<span class="overbooked"> · Full</span>` : ""}
					</p>
				</div>
			</div>
			<button class="cardaction fa-solid fa-ellipsis"></button>
		`;

		// Insert dot manually into the cardcontent
		const cardContent = card.querySelector(".cardcontent");
		cardContent?.prepend(dot);

		agendaContainer.appendChild(card);
	});

	checkIfEmptyAgenda();

	if (!agendaClickListenerAttached) {
		agendaContainer.addEventListener("click", async (e) => {
			const card = e.target.closest(".agendacard2");
			if (!card) return;

			const classId = card.dataset.id;

			if (internalUserRole === "admin") {
				openAdminModal(classId);
				return;
			}

			if (card.classList.contains("expired-class")) {
				showErrorToast();
				return;
			}

			if (!card.classList.contains("class-has-slots")) {
				showErrorToast();
				return;
			}

			const isBooked = userBookings.includes(classId);
			const confirmed = await confirmAction(
				isBooked
					? "Are we absolutely positive about this? Take your time, it's a big decision..."
					: "Look at you go! I'm proud of you for jumping on the health train!",
				isBooked ? "Cancel Class" : "Book Class"
			);

			if (!confirmed) return;

			if (isBooked) {
				await cancelBooking(classId);
			} else {
				await bookClass(classId);
			}

			const session = await getSession();
			const userId = session?.user?.id;
			await updateCalendarDots(userId);
			await renderAgenda(selectedDate);
		});
		agendaClickListenerAttached = true;
	}
}

function checkIfEmptyAgenda() {
	const container = document.getElementById("agenda");
	const allCards = container.querySelectorAll(".agendacard2");
	const anyVisible = Array.from(allCards).some(
		(card) => getComputedStyle(card).display !== "none"
	);

	// Check if message already exists
	let emptyMsg = container.querySelector(".empty-message");

	if (!anyVisible) {
		if (!emptyMsg) {
			const msg = document.createElement("div");
			msg.className = "empty-message";
			msg.innerHTML = `
				<img src="images/misc/no-data.svg" alt="No classes of the selected type available" />
				<p>No matching classes found.</p>
				
				
			`;
			container.appendChild(msg);
		}
	} else {
		if (emptyMsg) emptyMsg.remove();
	}
}

(async () => {
	await supabase.auth.refreshSession();
	await fetchUserRole();
	const session = await getSession();
	const userId = session?.user?.id;
	if (!userId) return;

	const { getAvailableClasses } = await import("./utils.js");
	const classes = await getAvailableClasses();

	setAgendaData(classes);
	renderAgenda(selectedDate);
	renderBookedAgenda("#landing-agenda");
})();

let bookingInProgress = new Set();

export async function bookClass(classId) {
	if (bookingInProgress.has(classId)) return;
	bookingInProgress.add(classId);

	try {
		const session = await getSession();
		const userId = session?.user?.id;
		if (!userId) throw new Error("Not logged in");

		const { error } = await supabase.rpc("book_class_transaction", {
			uid: userId,
			class_id: classId,
		});

		if (error) {
			showErrorToast();
			console.error("❌ RPC failed:", error.message);
			return;
		}

		showSuccessToast();
	} catch (err) {
		showErrorToast();
		console.error("❌ Unexpected booking error:", err.message);
	} finally {
		bookingInProgress.delete(classId);
	}
}

let cancelInProgress = new Set();

export async function cancelBooking(classId) {
	if (cancelInProgress.has(classId)) return;
	cancelInProgress.add(classId);

	try {
		const session = await getSession();
		const userId = session?.user?.id;
		if (!userId) throw new Error("Not logged in");

		const { error } = await supabase.rpc("cancel_booking_transaction", {
			p_uid: userId,
			p_class_id: classId,
		});

		if (error) {
			showErrorToast();
			console.error("❌ RPC failed:", error.message);
			return;
		}

		showSuccessToast();
	} catch (err) {
		console.error("❌ Unexpected cancel error:", err.message);
		showErrorToast();
	} finally {
		cancelInProgress.delete(classId);
	}
}

// Landing Page Agenda (RenderedBookedAgenda)

export async function renderBookedAgenda(selector = "#landing-agenda") {
	const container = document.querySelector(selector);
	if (!container) return;

	const session = await getSession();
	const userId = session?.user?.id;
	if (!userId) return;

	const all = await getAvailableClasses();
	const bookings = await getUserBookings(userId);
	const bookedClassIds = bookings.map((b) => b.class_id || b);

	const now = new Date();

	const upcomingBooked = all
		.filter((cls) => {
			const classDateTime = new Date(`${cls.date}T${cls.time}`);
			return classDateTime >= now && bookedClassIds.includes(cls.id);
		})
		.sort(
			(a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)
		);

	if (upcomingBooked.length === 0) {
		container.innerHTML = "<p>No upcoming classes booked.</p>";
		return;
	}

	container.innerHTML = "";

	const groupedByDate = {};
	upcomingBooked.forEach((cls) => {
		if (!groupedByDate[cls.date]) groupedByDate[cls.date] = [];
		groupedByDate[cls.date].push(cls);
	});

	for (const date in groupedByDate) {
		const group = groupedByDate[date];

		const dayContainer = document.createElement("div");
		dayContainer.className = "agenda-day-group";

		const dateHeading = document.createElement("h4");
		dateHeading.className = "agenda-date";
		dateHeading.textContent = new Date(date).toLocaleDateString(undefined, {
			weekday: "long",
			month: "long",
			day: "numeric",
		});
		dayContainer.appendChild(dateHeading);

		group.forEach((cls) => {
			const card = document.createElement("div");
			card.className = "agendacard2";
			card.classList.add("matches-filter");
			card.dataset.id = cls.id;

			const classDateTime = new Date(`${cls.date}T${cls.time}`);
			if (classDateTime < now) {
				card.classList.add("expired-class");
			}

			const timeFormatted = new Date(
				`1970-01-01T${cls.time}`
			).toLocaleTimeString([], {
				hour: "numeric",
				minute: "2-digit",
				hour12: true,
			});
			const slotsAvailable = cls.capacity - cls.booked_slots;
			const isFull = slotsAvailable < 1;
			if (slotsAvailable > 1) {
				card.classList.add("class-has-slots");
			}

			card.innerHTML = `
				<div class="cardpic">
					<img src="${cls.image_url || "images/classes/default.webp"}" alt="${
				cls.name
			}" />
				</div>
				<div class="cardcontent">
					<h3>${cls.name} ${
				cls.description
					? `<span id="description"> - ${cls.description}</span>`
					: ""
			}</h3>
					<div class="carddeets">
						<p class="time">${timeFormatted}</p>
						<p class="slots ${isFull ? "overbooked" : ""}">
							${slotsAvailable} slot${slotsAvailable !== 1 ? "s" : ""} available
							${isFull ? `<span class="overbooked"> · Full</span>` : ""}
						</p>
					</div>
				</div>
				<button class="cardaction fa-solid fa-ellipsis"></button>
			`;

			const cardContent = card.querySelector(".cardcontent");
			const dot = document.createElement("span");
			dot.classList.add("agenda-dot");
			dot.style.background = "var(--success-500)";
			cardContent?.prepend(dot);

			dayContainer.appendChild(card);
		});

		container.appendChild(dayContainer);
	}

	if (!window.landingAgendaClickListenerAttached) {
		const landingAgendaContainer = document.getElementById("landing-agenda");

		landingAgendaContainer.addEventListener("click", async (e) => {
			const card = e.target.closest(".agendacard2");
			if (!card) return;

			const classId = card.dataset.id;

			if (internalUserRole === "admin") {
				openAdminModal(classId);
				return;
			}

			const isBooked = userBookings.includes(classId);
			const confirmed = await confirmAction(
				isBooked
					? "Are we absolutely positive about this? Take your time, it's a big decision..."
					: "Look at you go! I'm proud of you for jumping on the health train!",
				isBooked ? "Cancel Class" : "Book Class"
			);
			if (!confirmed) return;

			if (isBooked) {
				await cancelBooking(classId);
			} else {
				await bookClass(classId);
			}

			const session = await getSession();
			const userId = session?.user?.id;
			await updateCalendarDots(userId);
			await renderBookedAgenda("#landing-agenda");
			await renderAgenda(selectedDate);
		});

		window.landingAgendaClickListenerAttached = true;
	}
}
