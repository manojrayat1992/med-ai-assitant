const menuButton = document.querySelector("[data-menu-button]");
const contactForm = document.querySelector("[data-contact-form]");
const startedAtInput = document.querySelector("[data-started-at]");
const demo = document.querySelector("[data-demo]");

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

if (demo) {
  const slides = [
    {
      kicker: "Step 01 / Operations",
      title: "Start from a clear clinical dashboard.",
      image: "/screenshots/app-dashboard.png",
      alt: "Med-AI Clinical dashboard screenshot",
      caption: "Teams see volume, analysis status, QA access, and platform health before entering review work.",
      pointOne: "Buyer message: this is workflow infrastructure, not an autonomous diagnosis product.",
      pointTwo: "Next action: choose a case queue and review before sign-off.",
    },
    {
      kicker: "Step 02 / Review",
      title: "Open the clinical workspace.",
      image: "/screenshots/app-clinical-workspace.png",
      alt: "Clinical workspace with report text and QA flags",
      caption: "Reviewers see report text, AI flags, evidence context, anatomy mapping, and sign-off state together.",
      pointOne: "Buyer message: AI drafts and flags while clinicians stay in control.",
      pointTwo: "Next action: inspect the flagged issue, edit the draft, then approve or hold.",
    },
    {
      kicker: "Step 03 / Governance",
      title: "Move cases through the QA worklist.",
      image: "/screenshots/app-worklist.png",
      alt: "Worklist showing report review status and critical acknowledgement",
      caption: "Pending, critical, and signed reports stay visible in one governed queue.",
      pointOne: "Buyer message: the workflow is auditable, not just a text-generation screen.",
      pointTwo: "Next action: acknowledge critical items and route cases for review.",
    },
    {
      kicker: "Step 04 / Pilot Evidence",
      title: "Measure the pilot, not the hype.",
      image: "/screenshots/app-qa-analytics.png",
      alt: "QA analytics dashboard with review metrics",
      caption: "Pilot teams can track acceptance, correction, rejection, and escalation patterns.",
      pointOne: "Buyer message: the pilot produces budget evidence before broad rollout.",
      pointTwo: "Next action: export pilot metrics and decide whether production integration is justified.",
    },
    {
      kicker: "Step 05 / Enterprise Path",
      title: "Keep integrations honest.",
      image: "/screenshots/app-integrations.png",
      alt: "Integrations status page for PACS RIS reporting and identity",
      caption: "PACS, RIS, reporting, and SSO status stay explicit until each item is connected and tested.",
      pointOne: "Buyer message: the roadmap is visible without pretending everything is finished.",
      pointTwo: "Next action: scope integration needs for a supervised validation pilot.",
    },
  ];
  const buttons = Array.from(demo.querySelectorAll("[data-demo-step]"));
  const title = demo.querySelector("[data-demo-title]");
  const kicker = demo.querySelector("[data-demo-kicker]");
  const image = demo.querySelector("[data-demo-image]");
  const caption = demo.querySelector("[data-demo-caption]");
  const pointOne = demo.querySelector("[data-demo-point-one]");
  const pointTwo = demo.querySelector("[data-demo-point-two]");

  function showSlide(index) {
    const slide = slides[index];
    buttons.forEach((button, buttonIndex) => {
      button.classList.toggle("is-active", buttonIndex === index);
    });
    kicker.textContent = slide.kicker;
    title.textContent = slide.title;
    image.src = slide.image;
    image.alt = slide.alt;
    caption.textContent = slide.caption;
    pointOne.textContent = slide.pointOne;
    pointTwo.textContent = slide.pointTwo;
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => showSlide(Number(button.dataset.demoStep)));
  });
}
