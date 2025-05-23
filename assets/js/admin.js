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
	groupClassesByDate,
} from "./utils.js";

import {
	loadCalendar,
	renderCalendar,
	refreshCalendarAfterAdminAction,
	refreshCalendarDots,
	classCache,
	setGroupedByDate,
} from "./calendar.js";

import {
	selectedDate,
	setAgendaData,
	getLocalDateStr,
	renderAgenda,
} from "./agenda.js";

let allClasses = [];
let userBookings = [];

document
	.getElementById("admin-modal-close")
	.addEventListener("click", async () => {
		document.getElementById("admin-modal").classList.remove("show");
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
	// ✅ Refresh class cache with updated class
	const key = `${new Date(cls.date).getUTCFullYear()}-${String(
		new Date(cls.date).getUTCMonth() + 1
	).padStart(2, "0")}`;

	if (classCache[key]) {
		const index = classCache[key].findIndex((c) => c.id === classId);
		if (index !== -1) {
			classCache[key][index] = cls;

			// Update global groupedByDate
			setGroupedByDate(groupClassesByDate(Object.values(classCache).flat()));
		}
	}

	// Optional: update dots visually
	refreshCalendarDots();
}

// Admin adds user to class via dropdown
document
	.getElementById("admin-add-user")
	.addEventListener("click", async () => {
		const userId = document.getElementById("admin-user-select").value;

		if (!userId) {
			showToast?.("Please select a user to add.", "warning");
			console.warn("⚠️ No user selected in admin-user-select dropdown");
			return;
		}

		const confirmed = await confirmAction(
			"Add this user to the class and deduct 1 credit?",
			"Add User"
		);
		if (!confirmed) {
			console.log("🚫 Admin cancelled booking confirmation");
			return;
		}

		try {
			const { error } = await supabase.rpc("admin_book_user_for_class", {
				uid: userId,
				class_id: currentClassId,
			});
			// 🧪 Add this:

			if (error) {
				console.error("❌ Admin booking RPC failed:", error.message);
				showToast("Failed to book user via admin.", "error");
				return;
			}

			showToast("✅ User added and charged 1 credit.", "success");
			console.log(
				`✅ Successfully booked user (${userId}) for class (${currentClassId})`
			);
			const classResponse = await supabase
				.from("classes")
				.select("id, booked_slots")
				.eq("id", currentClassId)
				.single();

			if (classResponse.error) {
				console.error(
					"❌ Error fetching updated class:",
					classResponse.error.message
				);
			} else {
				console.log("✅ Updated class info:", classResponse.data);
			}

			openAdminModal(currentClassId); // Refresh modal
			// You can redirect, reload, or just refresh your agenda
			// const bookingClassIds = await getUserBookings(userId);
			// await loadCalendar(bookingClassIds);
			await renderCalendar();
			await renderAgenda(selectedDate);
		} catch (err) {
			console.error("❌ Unexpected admin booking error:", err.message, err);
			showToast("An unexpected error occurred.", "error");
		}
	});

// Remove user from class (Admin)

document
	.getElementById("admin-user-list")
	.addEventListener("click", async (e) => {
		const button = e.target.closest(".remove-user-btn");
		if (!button) return;

		const userId = button.dataset.userId;

		const confirmed = await confirmAction(
			"Remove this user and refund 1 credit?",
			"Remove User"
		);
		if (!confirmed) return;

		try {
			const { error } = await supabase.rpc("admin_cancel_user_booking", {
				p_uid: userId,
				p_class_id: currentClassId,
			});

			if (error) {
				console.error("❌ RPC failed:", error.message);
				showToast("Error removing user via admin.", "error");
				return;
			}

			showToast("User removed and refunded.", "success");
			// You can redirect, reload, or just refresh your agenda
			// const bookingClassIds = await getUserBookings(userId);
			// await loadCalendar(bookingClassIds);
			await renderCalendar();
			await renderAgenda(selectedDate);

			// 🔁 Refresh modal
			openAdminModal(currentClassId);
		} catch (err) {
			console.error("❌ Unexpected error:", err.message);
			showToast("Error removing user.", "error");
		}
	});

// Delete class (Admin only)
document
	.getElementById("admin-delete-class")
	.addEventListener("click", async (e) => {
		// Make sure we capture the button even if icon is clicked
		const button = e.target.closest("#admin-delete-class");
		if (!button) return;

		const confirmed = await confirmAction(
			"Are you sure? This will delete the class and refund all users.",
			"Delete Class"
		);
		if (!confirmed) return;

		try {
			const { error } = await supabase.rpc("admin_delete_class", {
				p_class_id: currentClassId,
			});

			if (error) {
				console.error("❌ Failed to delete class via RPC:", error.message);
				showToast("Failed to delete class.", "error");
				return;
			}

			showToast("Class deleted and refunds issued.", "success");

			// Optional: reload calendar if admin is viewing their own bookings
			const session = await getSession();
			const userId = session?.user?.id;

			if (userId) {
				// const updatedBookings = await getUserBookings(userId);
				// await loadCalendar(updatedBookings);
				await renderCalendar();
				await renderAgenda(selectedDate);
			}
		} catch (err) {
			console.error("❌ Unexpected delete class error:", err.message);
			showToast("Something went wrong while deleting the class.", "error");
		}
	});
