import { supabase } from "./supabaseClient.js";

// Get current session
export async function getSession() {
	const {
		data: { session },
		error,
	} = await supabase.auth.getSession();
	if (error) {
		console.error("Session error:", error.message);
	}
	return session;
}

// Get User Profile by ID
export async function getUserProfile(userId) {
	const { data, error } = await supabase
		.from("profiles")
		.select("*")
		.eq("id", userId)
		.single();

	if (error) {
		console.error("Error fetching profile:", error.message);
		return null;
	}

	return data;
}

// Get All Classes
export async function getAvailableClasses() {
	const { data, error } = await supabase.from("classes").select("*");

	if (error) {
		console.error("Error fetching classes:", error.message);
		return [];
	}

	return data;
}

// Get Bookings for a User
export async function getUserBookings(userId) {
	const { data, error } = await supabase
		.from("bookings")
		.select("class_id")
		.eq("user_id", userId);

	if (error) {
		console.error("Error fetching bookings:", error.message);
		return [];
	}

	return data.map((b) => b.class_id);
}

// Get All Users (admin use)
export async function getAllUsers() {
	const { data, error } = await supabase
		.from("profiles")
		.select("id, name, surname, role");

	if (error) {
		console.error("Error fetching all users:", error.message);
		return [];
	}

	return data;
}

// Get All Bookings (admin use)
export async function getAllBookings() {
	const { data, error } = await supabase.from("bookings").select("*");

	if (error) {
		console.error("Error fetching all bookings:", error.message);
		return [];
	}

	return data;
}
