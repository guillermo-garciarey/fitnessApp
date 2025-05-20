// agenda.js

import { supabase } from "./supabaseClient.js";

import {
	getSession,
	getUserBookings,
	showToast,
	confirmAction,
	getAvailableClasses,
	formatDate,
} from "./utils.js";

import { loadCalendar, renderCalendar } from "./calendar.js";

import { openAdminModal } from "./admin.js";

let allClasses = [];
let userBookings = [];
let selectedDate = getLocalDateStr();
console.log("Agenda script loaded");
export let userRole = "user"; // default

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

	userRole = data.role || "user";
	console.log("👤 Role from profiles table:", userRole);
}

export function getLocalDateStr(date = new Date()) {
	return date.toLocaleDateString("sv-SE"); // "sv-SE" = YYYY-MM-DD format
}

export function setAgendaData(classes, bookings) {
	allClasses = classes;
	userBookings = bookings;
}

let agendaClickListenerAttached = false;

export async function renderAgenda(dateStr) {
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

	allClasses = latestClasses; // 🔁 Update global cache

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

		if (isBooked) {
			dot.style.background = "var(--color-green-300)";
		} else if (isMatch) {
			dot.style.background = "var(--color-amber-400)";
		} else {
			dot.style.background = "var(--gray-900)";
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

			if (userRole === "admin") {
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

			// 🔄 Update bookings
			const session = await getSession();
			const userId = session?.user?.id;
			userBookings = await getUserBookings(userId);

			// 🔄 Re-render with updated class and booking data
			await renderAgenda(selectedDate);
			loadCalendar(allClasses, userBookings);
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
	const bookings = await getUserBookings(userId);

	setAgendaData(classes, bookings);
	renderAgenda(selectedDate);
})();

// Booking Function

let bookingInProgress = new Set();

export async function bookClass(classId) {
	if (bookingInProgress.has(classId)) {
		console.log("🚫 Booking already in progress for", classId);
		return;
	}
	bookingInProgress.add(classId);

	try {
		const session = await getSession();
		const userId = session?.user?.id;
		if (!userId) throw new Error("Not logged in");

		// 🔁 Call the wrapped transaction
		const { error } = await supabase.rpc("book_class_transaction", {
			uid: userId,
			class_id: classId,
		});

		if (error) {
			showToast("Booking failed.", "error");
			console.error("❌ Booking transaction failed:", error.message);
			return;
		}

		// ✅ Done
		showToast("Class booked successfully!", "success");
		loadCalendar(allClasses, userBookings);
		renderAgenda(selectedDate);
	} catch (err) {
		showToast("Something went wrong.", "error");
		console.error("❌ Unexpected booking error:", err.message);
	} finally {
		bookingInProgress.delete(classId);
	}
}

// Cancellation

let cancelInProgress = new Set();

export async function cancelBooking(classId) {
	if (cancelInProgress.has(classId)) {
		console.log("🚫 Cancellation already in progress for", classId);
		return;
	}

	cancelInProgress.add(classId);

	try {
		const session = await getSession();
		const userId = session?.user?.id;
		if (!userId) throw new Error("Not logged in");

		// 🔁 Call Supabase RPC to cancel booking and refund
		const { error } = await supabase.rpc("cancel_booking_transaction", {
			uid: userId,
			class_id: classId,
		});

		if (error) {
			showToast("Cancellation failed.", "error");
			console.error("❌ RPC failed:", error.message);
			return;
		}

		// ✅ Success
		showToast("Booking cancelled and credit refunded!", "success");
		loadCalendar(allClasses, userBookings);
		renderAgenda(selectedDate);
	} catch (err) {
		showToast("Something went wrong during cancellation.", "error");
		console.error("❌ Unexpected cancel error:", err.message);
	} finally {
		cancelInProgress.delete(classId);
	}
}
