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
} from "./utils.js";

import {
	loadCalendar,
	renderCalendar,
	refreshCalendarDots,
	updateCalendarDots,
	userBookings, // ✅ imported from calendar.js
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

	// ✅ Step 1: Refresh classes from DB
	const { data: latestClasses, error } = await supabase
		.from("classes")
		.select("*");

	if (error || !latestClasses) {
		console.error("❌ Failed to fetch latest classes:", error?.message);
		agendaContainer.innerHTML =
			'<p class="error-msg">Could not load classes. Try again later.</p>';
		return;
	}

	allClasses = latestClasses;

	// ✅ Step 2: Continue with render logic
	const dayClasses = allClasses.filter((cls) => cls.date === selectedDate);
	const sortedClasses = dayClasses.sort((a, b) => a.time.localeCompare(b.time));

	if (sortedClasses.length === 0) {
		agendaContainer.innerHTML = `<p class="no-classes-msg">No classes on this day.</p>`;
		return;
	}

	const selectedFilter = document.getElementById("class-filter").value;

	sortedClasses.forEach((cls) => {
		const card = document.createElement("div");
		card.className = "agenda-card pressable";
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
		const isMatch =
			selectedFilter !== "bookings" && cls.name === selectedFilter;

		const dot = document.createElement("span");
		dot.classList.add("agenda-dot");

		if (internalUserRole === "admin") {
			if (cls.booked_slots > 0) {
				dot.style.background = "var(--color-red-400)"; // Admin dot for booked class
			} else {
				dot.style.background = "var(--gray-900)";
			}
		} else {
			if (isBooked) {
				dot.style.background = "var(--color-green-300)";
			} else if (isMatch) {
				dot.style.background = "var(--color-amber-400)";
			} else {
				dot.style.background = "var(--gray-900)";
			}
		}

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

	// Attach click handler only once
	if (!agendaClickListenerAttached) {
		agendaContainer.addEventListener("click", async (e) => {
			const card = e.target.closest(".agenda-card");
			if (!card) return;

			const classId = card.dataset.id;

			if (internalUserRole === "admin") {
				openAdminModal(classId);
				return;
			}

			const isBooked = userBookings.includes(classId);
			const confirmed = await confirmAction(
				isBooked
					? "Are you sure you want to cancel this class?"
					: "Book this class?"
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
			showToast("Booking failed.", "error");
			console.error("❌ RPC failed:", error.message);
			return;
		}

		showToast("Class booked successfully!", "success");
	} catch (err) {
		showToast("Something went wrong.", "error");
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
			showToast("Cancellation failed.", "error");
			console.error("❌ RPC failed:", error.message);
			return;
		}

		showToast("Booking cancelled and credit refunded!", "success");
	} catch (err) {
		console.error("❌ Unexpected cancel error:", err.message);
		showToast("Something went wrong during cancellation.", "error");
	} finally {
		cancelInProgress.delete(classId);
	}
}
