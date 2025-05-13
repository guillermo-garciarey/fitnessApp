// admin.js

import {
	supabase,
	getAvailableClasses,
	createUserBooking,
	getSession,
	formatPrettyDate,
} from "../../assets/js/utils.js";

// DOM Elements
const monthSelect = document.getElementById("filter-month");
const yearSelect = document.getElementById("filter-year");
const generateBtn = document.getElementById("generate-schedule");
const statusDiv = document.getElementById("schedule-status");

generateBtn.addEventListener("click", generateScheduleForMonth);

async function generateScheduleForMonth(e) {
	e.preventDefault();

	const month = parseInt(monthSelect.value); // 0-11
	const year = parseInt(yearSelect.value);

	if (isNaN(month) || isNaN(year)) {
		statusDiv.textContent = "Please select a valid month and year.";
		return;
	}

	// Step 0: Check for existing classes in selected month
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
		statusDiv.textContent =
			"Error checking existing classes: " + checkError.message;
		return;
	}

	if (existingClasses.length > 0) {
		statusDiv.textContent =
			"Time period already has classes — Please delete them before proceeding.";
		return;
	}

	// Step 1: Fetch template
	const { data: templates, error: templateError } = await supabase
		.from("class_schedule_template")
		.select("*")
		.eq("active", true);

	if (templateError) {
		statusDiv.textContent =
			"Error loading schedule template: " + templateError.message;
		return;
	}

	if (!templates || templates.length === 0) {
		statusDiv.textContent = "No schedule templates found.";
		return;
	}

	// Step 2: Generate dates for selected month
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const newClasses = [];

	for (let day = 1; day <= daysInMonth; day++) {
		const date = new Date(year, month, day);
		const dayOfWeek = date.getDay(); // 0=Sunday ... 6=Saturday
		const isoDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(
			day
		).padStart(2, "0")}`;

		templates.forEach((template) => {
			if (template.day_of_week === dayOfWeek) {
				newClasses.push({
					name: template.name,
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
		statusDiv.textContent = "Error generating classes: " + insertError.message;
	} else {
		statusDiv.textContent = "Success!";
	}
}
