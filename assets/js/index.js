import { supabase } from './supabaseClient.js';

console.log('Supabase client initialized');

// DOM references
const form = document.getElementById('signup-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const signupBtn = document.getElementById('signup-btn');
const signupPasswordConfirm = document.getElementById(
  'signup-password-confirm',
);

const signupOverlay = document.getElementById('signup-overlay');
const createAccountForm = document.getElementById('create-account-form');
const signupName = document.getElementById('signup-name');
const signupSurname = document.getElementById('signup-surname');
const signupEmail = document.getElementById('signup-email');
const signupPassword = document.getElementById('signup-password');
const signupPhone = document.getElementById('signup-phone');

// Capitalize helper
const capitalize = (str) =>
  str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

// Log in form submit
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailInput.value,
    password: passwordInput.value,
  });

  if (error) {
    alert('Log in failed - ' + error.message);
  } else {
    window.location.href = 'dashboard.html'; // Redirect on success
  }
});

// Show signup form when "Sign Up" is clicked
signupBtn.addEventListener('click', () => {
  signupOverlay.style.display = 'flex';
});

// Handle account creation
createAccountForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Password match check
  if (signupPassword.value !== signupPasswordConfirm.value) {
    alert('Passwords do not match. Please try again.');
    return;
  }

  // Step 1: Sign up user with auth
  const { data, error } = await supabase.auth.signUp({
    email: signupEmail.value,
    password: signupPassword.value,
    options: {
      emailRedirectTo:
        'https://guillermo-garciarey.github.io/fitnessApp/index.html',
    },
  });

  if (error || !data.user) {
    alert('Sign up failed: ' + (error?.message || 'Unknown error'));
    return;
  }

  const userId = data.user.id;

  // Step 2: Insert profile with capitalized name
  const name = capitalize(signupName.value.trim());
  const surname = capitalize(signupSurname.value.trim());
  const rawPhone = signupPhone.value.trim().replace(/\s+/g, '');

  const { error: profileError } = await supabase.from('profiles').insert([
    {
      id: userId,
      name,
      surname,
      email: signupEmail.value.toLowerCase(),
      role: 'user',
      phone_number: rawPhone,
    },
  ]);

  if (profileError) {
    alert('Profile creation failed: ' + profileError.message);
    return;
  }

  // Step 3: Notify and reset
  alert(
    'Account created! Please check your email to confirm before logging in.',
  );
  signupOverlay.style.display = 'none';
  createAccountForm.reset();
});

// Initial state: hide signup overlay
signupOverlay.style.display = 'none';
createAccountForm.reset();
