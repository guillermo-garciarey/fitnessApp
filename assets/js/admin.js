// Admin Modal

import { supabase } from "./supabaseClient.js";

import {
	getSession,
	getUserBookings,
	showToast,
	confirmAction,
	getAvailableClasses,
	adjustUserCredits,
	formatDate,
} from "./utils.js";

import { loadCalendar, renderCalendar } from "./calendar.js";

import { setAgendaData, getLocalDateStr, renderAgenda } from "./agenda.js";

let allClasses = [];
let userBookings = [];
let selectedDate = getLocalDateStr();

document
	.getElementById("admin-modal-close")
	.addEventListener("click", async () => {
		document.getElementById("admin-modal").classList.remove("show");

		// 🔄 Re-fetch latest bookings and classes
		// const session = await getSession();
		// const userId = session?.user?.id;

		// if (!userId) return;

		// allClasses = await getAvailableClasses();
		// userBookings = await getUserBookings(userId);

		// 🔁 Refresh views with fresh data
		// renderAgenda(selectedDate);
		// loadCalendar(allClasses, userBookings);
	});

export let currentClassId = null;

export async function openAdminModal(classId) {
	currentClassId = classId;
	setTimeout(() => {
		document.getElementById("admin-modal").classList.add("show");
	}, 500);

	const titleEl = document.getElementById("admin-modal-title");
	const dateEl = document.getElementById("admin-modal-date");
	const timeEl = document.getElementById("admin-modal-time");

	const userList = document.getElementById("admin-user-list");
	const userSelect = document.getElementById("admin-user-select");

	// Clear old data
	userList.innerHTML = "";
	userSelect.innerHTML = `<option value="">Add User</option>`;

	// 🔹 Fetch class info
	const { data: cls, error: clsErr } = await supabase
		.from("classes")
		.select("*")
		.eq("id", classId)
		.single();

	if (clsErr || !cls) {
		console.error("❌ Failed to fetch class:", clsErr?.message);
		return;
	}

	const dateFormatted = new Date(cls.date).toLocaleDateString("en-GB", {
		weekday: "long",
		day: "numeric",
		month: "long",
	});

	const timeFormatted = new Date(`1970-01-01T${cls.time}`).toLocaleTimeString(
		"en-GB",
		{
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		}
	);

	titleEl.textContent = cls.name;
	dateEl.textContent = dateFormatted;
	timeEl.textContent = timeFormatted;

	// 🔹 Fetch booked users
	const { data: bookings } = await supabase
		.from("bookings")
		.select("user_id, profiles(id, name, surname)")
		.eq("class_id", classId);

	// 🔹 Fetch all users
	const { data: allUsers } = await supabase
		.from("profiles")
		.select("id, name, surname, credits");

	const bookedUserIds = bookings.map((b) => b.user_id);

	// 🔹 List booked users
	bookings.forEach((b) => {
		const li = document.createElement("li");
		li.innerHTML = `
      ${b.profiles.name} ${b.profiles.surname}
      <button class="remove-user-btn" data-user-id="${b.user_id}">
  <i class="fa-solid fa-xmark"></i>
</button>
    `;
		userList.appendChild(li);
	});

	// 🔹 Populate add-user dropdown (excluding already booked)
	allUsers
		.filter((u) => !bookedUserIds.includes(u.id))
		.forEach((u) => {
			const option = document.createElement("option");
			option.value = u.id;
			option.textContent = `${u.name} ${u.surname} (${u.credits} cr)`;
			userSelect.appendChild(option);
		});
}

// Remove user from class (Admin Only)

document
	.getElementById("admin-user-list")
	.addEventListener("click", async (e) => {
		const button = e.target.closest(".remove-user-btn");
		if (!button) return;

		const userId = button.dataset.userId;

		const confirmed = await confirmAction(
			"Remove this user and refund 1 credit?"
		);
		if (!confirmed) return;

		try {
			// 1. Remove booking
			await supabase.from("bookings").delete().match({
				user_id: userId,
				class_id: currentClassId,
			});

			// 2. Add refund row
			await supabase.from("payments").insert({
				user_id: userId,
				credits: 1,
				reason: "Admin refund",
				date: new Date().formatDate(dateObj),
			});

			// 3. Update credits in profile
			const { error: creditUpdateError } = await adjustUserCredits(userId, +1);

			if (creditUpdateError) {
				console.error(
					"❌ Failed to update credits via JS:",
					creditUpdateError.message
				);
				showToast?.("Failed to update credits", "error");
			}

			// 4. Decrement booked_slots
			const { data: classData, error: fetchError } = await supabase
				.from("classes")
				.select("booked_slots")
				.eq("id", currentClassId)
				.single();

			if (!fetchError && classData) {
				const newBookedCount = Math.max((classData.booked_slots || 0) - 1, 0);

				await supabase
					.from("classes")
					.update({ booked_slots: newBookedCount })
					.eq("id", currentClassId);
			}

			showToast("User removed and refunded.", "success");

			// 🔁 Refresh modal content
			openAdminModal(currentClassId);
		} catch (err) {
			console.error("❌ Failed to remove user:", err.message);
			showToast("Error removing user.", "error");
		}
	});

// Add user to class (Admin only)

document
	.getElementById("admin-add-user")
	.addEventListener("click", async () => {
		const userId = document.getElementById("admin-user-select").value;

		if (!userId) {
			showToast?.("Please select a user to add.", "warning");
			return;
		}

		const confirmed = await confirmAction(
			"Add this user to the class and deduct 1 credit?"
		);
		if (!confirmed) return;

		try {
			// 1. Add booking
			await supabase.from("bookings").insert({
				user_id: userId,
				class_id: currentClassId,
			});

			// 2. Subtract 1 credit in payments
			await supabase.from("payments").insert({
				user_id: userId,
				credits: -1,
				reason: "Admin booking",
				date: new Date().formatDate(dateObj),
			});

			// 3. Update profile credit
			const { error: creditUpdateError } = await adjustUserCredits(userId, -1);

			if (creditUpdateError) {
				console.error(
					"❌ Failed to deduct credits via JS:",
					creditUpdateError.message
				);
				showToast?.("Failed to deduct credits", "error");
			}

			// 4. Increment class booked_slots
			const { data: classData, error: fetchError } = await supabase
				.from("classes")
				.select("booked_slots")
				.eq("id", currentClassId)
				.single();

			if (fetchError) throw new Error(fetchError.message);

			const newBookedCount = (classData.booked_slots || 0) + 1;

			await supabase
				.from("classes")
				.update({ booked_slots: newBookedCount })
				.eq("id", currentClassId);

			showToast("User added and charged 1 credit.", "success");

			// 🔁 Refresh modal content
			openAdminModal(currentClassId);
		} catch (err) {
			console.error("❌ Error adding user to class:", err.message);
			showToast("Failed to add user to class.", "error");
		}
	});
