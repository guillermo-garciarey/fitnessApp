// agenda.js

import { supabase } from "./supabaseClient.js";

import {
	getSession,
	getUserBookings,
	showToast,
	confirmAction,
	getAvailableClasses,
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

	// Attach event listener only once using delegation
	if (!agendaClickListenerAttached) {
		agendaContainer.addEventListener("click", async (e) => {
			const card = e.target.closest(".agenda-card");
			if (!card) return;

			const classId = card.dataset.id;
			// 🧠 Check admin role
			if (userRole === "admin") {
				openAdminModal(classId);
				return; // 🛑 Stop regular booking flow
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
				console.log("📌 Booking classId:", classId);
				await bookClass(classId);
			}

			// 🔄 Re-fetch updated bookings from DB
			const session = await getSession();
			const userId = session?.user?.id;
			userBookings = await getUserBookings(userId);

			// 🔄 Re-render agenda
			renderAgenda(selectedDate);
			loadCalendar(allClasses, userBookings);
			console.log("📨 Booking triggered for", classId, "at", Date.now());
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

let bookingInProgress = new Set(); // Tracks classes being booked

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

		// 1. Insert booking row
		const { error: bookingError } = await supabase
			.from("bookings")
			.insert([{ user_id: userId, class_id: classId }]);

		if (bookingError) {
			showToast("Booking failed.", "error");
			console.error("❌ Booking insert failed:", bookingError.message);
			// alert("Booking failed: " + bookingError.message);
			return;
		}

		// 2. Insert payment row
		const { error: paymentError } = await supabase.from("payments").insert([
			{
				user_id: userId,
				credits: -1,
				reason: "Class Booking",
				date: new Date().toISOString().split("T")[0], // YYYY-MM-DD
			},
		]);

		if (paymentError) {
			showToast("Booking failed during payment.", "error");
			console.error("❌ Payment insert failed:", paymentError.message);
			// alert("Booking failed during payment.");
			return;
		}

		// 2.5 Update profile credits (add -1)
		const { error: creditUpdateError } = await supabase.rpc(
			"adjust_user_credits",
			{
				uid: userId,
				delta: -1,
			}
		);

		if (creditUpdateError) {
			showToast("Booking failed while updating credits.", "error");
			console.error(
				"❌ Failed to update profile credits:",
				creditUpdateError.message
			);
			return;
		}

		// 3. Fetch current class booked_slots
		const { data: classData, error: fetchError } = await supabase
			.from("classes")
			.select("booked_slots")
			.eq("id", classId)
			.single();

		if (fetchError || !classData) {
			showToast("Booking failed while syncing class slots.", "error");
			console.error("❌ Could not fetch class:", fetchError?.message);
			// alert("Booking failed while syncing class slots.");
			return;
		}

		// 4. Update booked_slots count
		const newBookedCount = (classData.booked_slots || 0) + 1;

		const { error: updateError } = await supabase
			.from("classes")
			.update({ booked_slots: newBookedCount })
			.eq("id", classId);

		if (updateError) {
			showToast("Booking failed while updating class.", "error");
			console.error("❌ Class update failed:", updateError.message);
			// alert("Booking failed while updating class.");
			return;
		}

		// ✅ Done
		showToast("Class booked successfully!", "success");
		loadCalendar(allClasses, userBookings);
		renderAgenda(selectedDate); // Refresh agenda UI
	} catch (err) {
		showToast("Something went wrong.", "error");
		console.error("❌ Unexpected booking error:", err.message);
		alert("Something went wrong.");
	} finally {
		bookingInProgress.delete(classId); // Release guard
	}
}

// Cancellation

let cancelInProgress = new Set(); // Optional safety guard

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

		// 1. Remove the booking
		const { error: deleteError } = await supabase
			.from("bookings")
			.delete()
			.eq("user_id", userId)
			.eq("class_id", classId);

		if (deleteError) {
			showToast("Cancellation failed.", "error");
			console.error("❌ Booking delete failed:", deleteError.message);
			return;
		}

		// 2. Insert positive payment row
		const { error: paymentError } = await supabase.from("payments").insert([
			{
				user_id: userId,
				credits: 1,
				reason: "Booking Cancelled",
				date: new Date().toISOString().split("T")[0],
			},
		]);

		if (paymentError) {
			showToast("Cancellation failed during refund.", "error");
			console.error("❌ Payment insert failed:", paymentError.message);
			return;
		}

		// 3. Update profile credits (+1)
		const { error: creditUpdateError } = await supabase.rpc(
			"adjust_user_credits",
			{
				uid: userId,
				delta: 1,
			}
		);

		if (creditUpdateError) {
			showToast("Cancellation failed while updating credits.", "error");
			console.error(
				"❌ Failed to update profile credits:",
				creditUpdateError.message
			);
			return;
		}

		// 4. Update class's booked_slots
		const { data: classData, error: fetchError } = await supabase
			.from("classes")
			.select("booked_slots")
			.eq("id", classId)
			.single();

		if (fetchError || !classData) {
			showToast("Cancellation failed while syncing class slots.", "error");
			console.error("❌ Could not fetch class:", fetchError?.message);
			return;
		}

		const newCount = Math.max(data.booked_slots - 1, 0);

		const { error: updateError } = await supabase
			.from("classes")
			.update({ booked_slots: newCount })
			.eq("id", classId);

		if (updateError) {
			console.error("❌ Failed to update booked_slots:", updateError.message);
			showToast("Failed to update booked_slots.", "error");
		} else {
			console.log("✅ booked_slots updated to:", newCount);
		}

		// ✅ Done
		showToast("Booking cancelled and credit refunded!", "success");
		loadCalendar(allClasses, userBookings);
		renderAgenda(selectedDate); // Refresh agenda UI
	} catch (err) {
		showToast("Something went wrong during cancellation.", "error");
		console.error("❌ Unexpected cancel error:", err.message);
	} finally {
		cancelInProgress.delete(classId);
	}
}
