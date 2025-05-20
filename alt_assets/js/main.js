(function ($) {
	var $window = $(window),
		$body = $("body"),
		$header = $("#header"),
		$titleBar = null,
		$nav = $("#nav"),
		$wrapper = $("#wrapper");

	// Breakpoints.
	breakpoints({
		xlarge: ["1281px", "1680px"],
		large: ["1025px", "1280px"],
		medium: ["737px", "1024px"],
		small: ["481px", "736px"],
		xsmall: [null, "480px"],
	});

	// Play initial animations on page load.
	$window.on("load", function () {
		window.setTimeout(function () {
			$body.removeClass("is-preload");
		}, 100);
	});

	// Tweaks/fixes.

	// Polyfill: Object fit.
	if (!browser.canUse("object-fit")) {
		$(".image[data-position]").each(function () {
			var $this = $(this),
				$img = $this.children("img");

			// Apply img as background.
			$this
				.css("background-image", 'url("' + $img.attr("src") + '")')
				.css("background-position", $this.data("position"))
				.css("background-size", "cover")
				.css("background-repeat", "no-repeat");

			// Hide img.
			$img.css("opacity", "0");
		});
	}

	// Header Panel.

	// Nav.
	var $nav_a = $nav.find("a");

	$nav_a
		.addClass("scrolly")
		.on("click", function (e) {
			const $this = $(this);
			const href = $this.attr("href");

			// 🚫 Skip scroll for empty or bad hrefs
			if (!href || href === "" || href === "#" || href.charAt(0) !== "#") {
				e.preventDefault(); // 👈 stop the scroll!
				return;
			}

			$nav_a.removeClass("active");
			$this.addClass("active active-locked");
		})
		.each(function () {
			var $this = $(this),
				id = $this.attr("href");

			// Skip invalid IDs.
			if (!id || id === "#") return;

			var $section = $(id);

			// No section for this link? Bail.
			if ($section.length < 1) return;

			// Scrollex.
			$section.scrollex({
				mode: "middle",
				top: "5vh",
				bottom: "5vh",
				initialize: function () {
					// Optionally deactivate section here.
				},
				enter: function () {
					// Optionally activate section here.
				},
			});
		});

	// Scrolly.
	$(".scrolly").scrolly({
		speed: 1000,
		offset: function () {
			return breakpoints.active("<=medium") && $titleBar
				? $titleBar.height()
				: 0;
		},
	});
})(jQuery);
