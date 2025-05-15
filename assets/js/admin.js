import {
	supabase,
	getAvailableClasses,
	createUserBooking,
	getSession,
	formatPrettyDate,
	showConfirmation,
} from "../../assets/js/utils.js";

// ✅ Trigger from calendar icon
document.addEventListener("click", async (e) => {
	if (e.target.matches(".month-generate")) {
		const date = e.target.dataset.date;
		if (!date) return;

		const dateObj = new Date(date);
		const month = dateObj.getMonth(); // 0-indexed
		const year = dateObj.getFullYear();

		const confirmMsg = `Generate schedule for ${dateObj.toLocaleString(
			"default",
			{ month: "long" }
		)} ${year}?`;

		if (!confirm(confirmMsg)) return;

		await generateScheduleForMonth(month, year);
	}
});

// ✅ Core schedule generation logic
export async function generateScheduleForMonth(month, year) {
	if (isNaN(month) || isNaN(year)) {
		alert("Invalid month or year.");
		return;
	}

	// Step 0: Check for existing classes
	const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
	const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${new Date(
		year,
		month + 1,
		0
	).getDate()}`;

	const { data: existingClasses, error: checkError } = await supabase
		.from("classes")
		.select("id")
		.gte("date", startDate)
		.lte("date", endDate);

	if (checkError) {
		alert("Error checking existing classes: " + checkError.message);
		return;
	}

	if (existingClasses.length > 0) {
		alert("Month already has classes — please delete them before proceeding.");
		return;
	}

	// Step 1: Fetch template
	const { data: templates, error: templateError } = await supabase
		.from("class_schedule_template")
		.select("*")
		.eq("active", true);

	if (templateError) {
		alert("Error loading template: " + templateError.message);
		return;
	}

	if (!templates || templates.length === 0) {
		alert("No schedule templates found.");
		return;
	}

	// Step 2: Generate new classes
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const newClasses = [];

	for (let day = 1; day <= daysInMonth; day++) {
		const date = new Date(year, month, day);
		const dayOfWeek = date.getDay(); // 0 = Sunday
		const isoDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(
			day
		).padStart(2, "0")}`;

		templates.forEach((template) => {
			if (template.day_of_week === dayOfWeek) {
				newClasses.push({
					name: template.name,
					description: template.description || null, // ✅ include it here
					trainer: template.trainer,
					date: isoDate,
					time: template.time,
					capacity: template.capacity,
					booked_slots: 0,
				});
			}
		});
	}

	// Step 3: Insert into `classes`
	const { error: insertError } = await supabase
		.from("classes")
		.insert(newClasses);

	if (insertError) {
		alert("Error inserting classes: " + insertError.message);
	} else {
		alert("Schedule generated successfully!");
	}
}
