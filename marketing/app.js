const menuButton = document.querySelector("[data-menu-button]");
const contactForm = document.querySelector("[data-contact-form]");

if (menuButton) {
  menuButton.addEventListener("click", () => {
    document.body.classList.toggle("nav-open");
    menuButton.setAttribute(
      "aria-expanded",
      document.body.classList.contains("nav-open") ? "true" : "false"
    );
  });
}

if (contactForm) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(contactForm);
    const subject = encodeURIComponent("Design Partner Inquiry - Med-AI Clinical");
    const body = encodeURIComponent(
      [
        `Name: ${data.get("name") || ""}`,
        `Organization: ${data.get("organization") || ""}`,
        `Email: ${data.get("email") || ""}`,
        `Role: ${data.get("role") || ""}`,
        `Interest: ${data.get("interest") || ""}`,
        "",
        data.get("message") || "",
      ].join("\n")
    );
    window.location.href = `mailto:hello@medaiclinical.com?subject=${subject}&body=${body}`;
  });
}
