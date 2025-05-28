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

	const session = await getSession();
	const userId = session?.user?.id;

	const { data: waitlisted, error: waitlistError } = await supabase
		.from("waitlist")
		.select("class_id")
		.eq("user_id", userId);

	const waitlistedClassIds = (waitlisted || []).map((w) => w.class_id);

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
		const isWaitlisted = waitlistedClassIds.includes(cls.id);

		if (isBooked) card.classList.add("has-booking");
		if (isWaitlisted) card.classList.add("waitlisted");

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
		if (slotsAvailable > 0) {
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
		cardContent?.prepend(dot);
		agendaContainer.appendChild(card);
	});

	checkIfEmptyAgenda();

	// Remove previous listener to avoid duplicates
	agendaContainer.replaceWith(agendaContainer.cloneNode(true));
	const refreshedAgendaContainer = document.getElementById("agenda");

	refreshedAgendaContainer.addEventListener("click", async (e) => {
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

		const isBooked = userBookings.includes(classId);
		const isWaitlisted = waitlistedClassIds.includes(classId);
		const isFull = !card.classList.contains("class-has-slots");

		let confirmed;

		if (isBooked) {
			confirmed = await confirmAction(
				"Are we absolutely positive about this? Take your time, it's a big decision...",
				"Cancel Class"
			);
			if (!confirmed) return;
			await cancelBooking(classId);
		} else if (isFull && isWaitlisted) {
			confirmed = await confirmAction(
				"You're on the waitlist for this class. Remove yourself?",
				"Leave Waitlist"
			);
			if (!confirmed) return;
			await removeFromWaitlist(classId);
		} else if (isFull && !isWaitlisted) {
			confirmed = await confirmAction(
				"This class is full, but you can join the waitlist.",
				"Join Waitlist"
			);
			if (!confirmed) return;
			await addToWaitlist(classId);
		} else {
			confirmed = await confirmAction(
				"Look at you go! I'm proud of you for jumping on the health train!",
				"Book Class"
			);
			if (!confirmed) return;
			await bookClass(classId);
		}

		const session = await getSession();
		const userId = session?.user?.id;
		await updateCalendarDots(userId);
		await renderAgenda(selectedDate);
	});
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

	// Optional: Still store classes globally if needed
	setAgendaData(classes);

	// ✅ Fetch waitlisted class IDs
	const { data: waitlisted, error: waitlistError } = await supabase
		.from("waitlist")
		.select("class_id")
		.eq("user_id", userId);

	const waitlistedClassIds = (waitlisted || []).map((w) => w.class_id);

	// ✅ Pass waitlisted class IDs into both renders
	renderAgenda(selectedDate, waitlistedClassIds);
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

		// This RPC books the class AND removes user from waitlist (if applicable)
		const { error } = await supabase.rpc("book_class_transaction", {
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

// Add user to waitlist for a class
export async function addToWaitlist(classId) {
	const session = await getSession();
	const userId = session?.user?.id;
	if (!userId) {
		showToast("awww dang!", "error", "Please log in to join the waitlist.");
		return;
	}

	const { data, error } = await supabase.from("waitlist").insert([
		{
			class_id: classId,
			user_id: userId,
		},
	]);

	if (error) {
		console.error("❌ Failed to join waitlist:", error.message);
		showToast("awww dang!", "error", "We couldn't add you to the waitlist.");
		return;
	}

	showToast(
		"yay!",
		"success",
		"You're on the waitlist! We'll let you know if a spot opens up : )"
	);
}

// Remove user from waitlist (optional UI feature)
export async function removeFromWaitlist(classId) {
	const session = await getSession();
	const userId = session?.user?.id;
	if (!userId) return;

	const { error } = await supabase
		.from("waitlist")
		.delete()
		.match({ class_id: classId, user_id: userId });

	if (error) {
		console.error("❌ Failed to remove from waitlist:", error.message);
		showToast(
			"awww dang!",
			"error",
			"We couldn't remove you from the waitlist : ("
		);
		return;
	}

	showToast("yay!", "success", "You've been removed from the waitlist : )");
}
