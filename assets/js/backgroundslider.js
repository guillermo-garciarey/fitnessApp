// background.js
window.addEventListener("DOMContentLoaded", function () {
	(function () {
		"use strict";

		// Configuration
		const settings = {
			images: {
				"images/background1.jpg": "center",
				"images/background2.jpg": "center",
				"images/background3.jpg": "center",
			},
			delay: 6000,
		};

		// Target container
		const wrapper = document.getElementById("wrapper");
		if (!wrapper) {
			console.warn("#wrapper not found for background slideshow.");
			return;
		}

		// Create background wrapper
		const bgWrapper = document.createElement("div");
		bgWrapper.id = "bg";
		wrapper.appendChild(bgWrapper);

		const bgs = [];
		let pos = 0;

		// Create background layers
		for (const [url, position] of Object.entries(settings.images)) {
			const bg = document.createElement("div");
			bg.className = "bg-slide";
			bg.style.backgroundImage = `url('${url}')`;
			bg.style.backgroundPosition = position;

			bgWrapper.appendChild(bg);
			bgs.push(bg);
		}

		if (bgs.length <= 1) {
			bgs[0]?.classList.add("visible", "top");
			return;
		}

		bgs[pos].classList.add("visible", "top");

		setInterval(() => {
			const lastPos = pos;
			pos = (pos + 1) % bgs.length;

			bgs[lastPos].classList.remove("top");
			bgs[pos].classList.add("visible", "top");

			setTimeout(() => {
				bgs[lastPos].classList.remove("visible");
			}, settings.delay / 2);
		}, settings.delay);
	})();
});
console.log("✅ background.js loaded");
