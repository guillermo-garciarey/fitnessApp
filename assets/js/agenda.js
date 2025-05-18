// agenda.js

import { supabase } from "./supabaseClient.js";

import {
	getSession,
	getUserBookings,
	showToast,
	confirmAction,
} from "./utils.js";

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

	agendaContainer.addEventListener("click", async (e) => {
		const card = e.target.closest(".agenda-card");
		if (!card) return;

		const classId = card.dataset.id;

		const isBooked = userBookings.includes(classId);

		if (isBooked) {
			const confirmed = await confirmAction(
				"Are you sure you want to cancel this class?"
			);
			if (!confirmed) return;
			await cancelBooking(classId);
		} else {
			const confirmed = await confirmAction("Book this class?");
			if (!confirmed) return;
			console.log("📌 Booking classId:", classId);
			await bookClass(classId);
		}

		// 🔄 Re-fetch updated bookings from DB
		const session = await getSession();
		const userId = session?.user?.id;
		userBookings = await getUserBookings(userId);

		// 🔄 Re-render with updated bookings
		renderAgenda(selectedDate);
		console.log("📨 Booking triggered for", classId, "at", Date.now());
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

		console.log("📨 Booking triggered for", classId);

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
		renderAgenda(selectedDate); // Refresh agenda UI
	} catch (err) {
		showToast("Something went wrong.", "error");
		console.error("❌ Unexpected booking error:", err.message);
		alert("Something went wrong.");
	} finally {
		bookingInProgress.delete(classId); // Release guard
	}
}

// Cancel Booking Function

let cancelInProgress = new Set();

export async function cancelBooking(classId) {
	try {
		const session = await getSession();
		const userId = session?.user?.id;
		if (!userId) throw new Error("Not logged in");

		// 1. Remove booking row
		const { error: deleteError } = await supabase
			.from("bookings")
			.delete()
			.eq("user_id", userId)
			.eq("class_id", classId);

		if (deleteError) {
			console.error("❌ Booking delete failed:", deleteError.message);
			showToast("Cancel failed.", "error");
			return;
		}

		// 2. Add payment (+1 credit)
		const { error: paymentError } = await supabase.from("payments").insert([
			{
				user_id: userId,
				credits: 1,
				reason: "Cancelled Booking",
				date: new Date().toISOString().split("T")[0],
			},
		]);

		if (paymentError) {
			console.error("❌ Payment insert failed:", paymentError.message);
			showToast("Cancel failed (payment error).", "error");
			return;
		}

		// 3. Decrement booked_slots
		const { data: classData, error: fetchError } = await supabase
			.from("classes")
			.select("booked_slots")
			.eq("id", classId)
			.single();

		if (fetchError) {
			console.error("❌ Fetch class failed:", fetchError.message);
			showToast("Cancel failed (class fetch).", "error");
			return;
		}

		const newBookedCount = Math.max((classData?.booked_slots || 1) - 1, 0);

		const { error: updateError } = await supabase
			.from("classes")
			.update({ booked_slots: newBookedCount })
			.eq("id", classId);

		if (updateError) {
			console.error("❌ Class update failed:", updateError.message);
			showToast("Cancel failed (class update).", "error");
			return;
		}

		showToast("Booking cancelled.");
		renderAgenda(selectedDate);
	} catch (err) {
		console.error("❌ Unexpected cancel error:", err);
		showToast("Something went wrong.", "error");
	} finally {
		cancelInProgress.delete(classId); // Always release lock
	}
}
