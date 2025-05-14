import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Supabase setup
const supabaseUrl = "https://jbcrdyjoggrsdiwkipda.supabase.co";
const supabaseKey =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiY3JkeWpvZ2dyc2Rpd2tpcGRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5NzY2ODksImV4cCI6MjA2MjU1MjY4OX0.Pa1rIyOnmM00fJTqRXj-IUHyLFCas1qBiMjBL4FFJFE";

export const supabase = createClient(supabaseUrl, supabaseKey);

console.log("Supabase client initialized");

// DOM references
const form = document.getElementById("signup-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const signupBtn = document.getElementById("signup-btn");

const signupOverlay = document.getElementById("signup-overlay");
const createAccountForm = document.getElementById("create-account-form");
const signupName = document.getElementById("signup-name");
const signupSurname = document.getElementById("signup-surname");
const signupEmail = document.getElementById("signup-email");
const signupPassword = document.getElementById("signup-password");

// Capitalize helper
const capitalize = (str) =>
	str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

// Log in form submit
form.addEventListener("submit", async (e) => {
	e.preventDefault();

	const { data, error } = await supabase.auth.signInWithPassword({
		email: emailInput.value,
		password: passwordInput.value,
	});

	if (error) {
		alert("Log in failed - " + error.message);
	} else {
		window.location.href = "dashboard.html"; // Redirect on success
	}
});

// Show signup form when "Sign Up" is clicked
signupBtn.addEventListener("click", () => {
	signupOverlay.style.display = "flex";
});

// Handle account creation
createAccountForm.addEventListener("submit", async (e) => {
	e.preventDefault();

	// Step 1: Sign up user with auth
	const { data, error } = await supabase.auth.signUp({
		email: signupEmail.value,
		password: signupPassword.value,
	});

	if (error || !data.user) {
		alert("Sign up failed: " + (error?.message || "Unknown error"));
		return;
	}

	const userId = data.user.id;

	// Step 2: Insert profile with capitalized name
	const name = capitalize(signupName.value.trim());
	const surname = capitalize(signupSurname.value.trim());

	const { error: profileError } = await supabase.from("profiles").insert([
		{
			id: userId,
			name,
			surname,
			email: signupEmail.value.toLowerCase(),
			role: "user",
		},
	]);

	if (profileError) {
		alert("Profile creation failed: " + profileError.message);
		return;
	}

	// Step 3: Notify and reset
	alert(
		"Account created! Please check your email to confirm before logging in."
	);
	signupOverlay.style.display = "none";
	createAccountForm.reset();
});

// Initial state: hide signup overlay
signupOverlay.style.display = "none";
createAccountForm.reset();
