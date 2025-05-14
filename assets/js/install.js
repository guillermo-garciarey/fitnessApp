let deferredPrompt;
const installBtn = document.getElementById("install-btn");

// Hide the button by default
if (installBtn) {
  installBtn.style.display = "none";
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); // Stop automatic prompt
  deferredPrompt = e;

  // Show the install button
  if (installBtn) {
    installBtn.style.display = "block";
  }
});

if (installBtn) {
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      console.log("User accepted the install prompt");
    } else {
      console.log("User dismissed the install prompt");
    }

    deferredPrompt = null;
    installBtn.style.display = "none";
  });
}
