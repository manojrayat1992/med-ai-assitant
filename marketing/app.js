const menuButton = document.querySelector("[data-menu-button]");
const contactForm = document.querySelector("[data-contact-form]");
const startedAtInput = document.querySelector("[data-started-at]");

if (startedAtInput) {
  startedAtInput.value = String(Date.now());
}

if (menuButton) {
  menuButton.addEventListener("click", () => {
    document.body.classList.toggle("nav-open");
    menuButton.setAttribute(
      "aria-expanded",
      document.body.classList.contains("nav-open") ? "true" : "false"
    );
  });
}

function buildContactMailto(payload) {
  const subject = encodeURIComponent("Design Partner Inquiry - Med-AI Clinical");
  const body = encodeURIComponent(
    [
      `Name: ${payload.name || ""}`,
      `Organization: ${payload.organization || ""}`,
      `Email: ${payload.email || ""}`,
      `Role: ${payload.role || ""}`,
      `Interest: ${payload.interest || ""}`,
      "",
      payload.message || "",
    ].join("\n")
  );

  return `mailto:hello@medaiclinical.com?subject=${subject}&body=${body}`;
}

if (contactForm) {
  const status = contactForm.querySelector("[data-form-status]");
  const submit = contactForm.querySelector("[data-contact-submit]");

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(contactForm);
    const payload = Object.fromEntries(data.entries());

    status.textContent = "Sending your request...";
    status.dataset.state = "loading";
    submit.disabled = true;

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.ok === false) {
        const error = new Error(result.message || "Could not send the message.");
        error.status = response.status;
        throw error;
      }

      status.textContent = result.message || "Thanks. We received your request.";
      status.dataset.state = "success";
      contactForm.reset();
      if (startedAtInput) startedAtInput.value = String(Date.now());
    } catch (error) {
      if (error.status >= 500) {
        status.textContent = "Automatic send is not available yet. Opening an email draft instead.";
        window.location.href = buildContactMailto(payload);
      } else {
        status.textContent =
          error.message || "We could not send the message right now. Please email hello@medaiclinical.com directly.";
      }
      status.dataset.state = "error";
    } finally {
      submit.disabled = false;
    }
  });
}
