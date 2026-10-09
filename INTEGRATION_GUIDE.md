# Spark Chatbot Frontend Integration Guide

This guide walks developers through integrating the redesigned Spark chatbot component ([v3.html](file:///d:/Z_work/Sujay/Spark%20-%20PMT%20chatbot/v3.html)) into the live Pain Management Technologies website page template as illustrated in [integration.html](file:///d:/Z_work/Sujay/Spark%20-%20PMT%20chatbot/integration.html).

---

## 1. Architectural Overview

The live website page (`paintechnology.com/spark`) uses a universal header and footer layout. The Spark chatbot is designed to live as a **self-contained embedded section** inside `#bodyContent .container`, immediately beneath the Spark header banner image and above the instructional video row.

```
┌─────────────────────────────────────────────────────────────┐
│ Universal Website Header & Global Navigation                │
└─────────────────────────────────────────────────────────────┘
  <section id="bodyContent" class="spark-page bodyWhiteBg">
    <div class="container py-5">
      
      <!-- 1. Header Banner -->
      <img class="spark-header" src=".../spark-header.png">

      ┌───────────────────────────────────────────────────────┐
      │  Spark Chatbot Embedded Component (v3.html)          │
      │  - Clean initial state (Search prompt + Category grid)│
      │  - "Talk to a Human" buttons & Support Ticket modal   │
      │  - Live n8n chat streaming & duration analytics       │
      └───────────────────────────────────────────────────────┘

      <!-- 2. Patient Videos & Resource Links -->
      <div class="row spark-videos">...</div>
      <a class="spark-resources">Visit our Resources page</a>

    </div>
  </section>
┌─────────────────────────────────────────────────────────────┐
│ Universal Website Footer & Copyright                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Choosing an Integration Method

There are **two supported methods** to integrate [v3.html](file:///d:/Z_work/Sujay/Spark%20-%20PMT%20chatbot/v3.html) into your CMS / template:

| Feature | Method A: Native DOM Injection (Recommended) | Method B: Iframe Embedding |
| :--- | :--- | :--- |
| **Setup Complexity** | Low (Split CSS, HTML, JS into page template) | Low (Place `v3.html` on server & link via `iframe`) |
| **Mobile Responsiveness** | Seamless natural height, no nested scrollbars | Requires fixed height or `postMessage` resizer |
| **CSS Isolation** | Scoped via `.pmt-*` and `.spark-*` classes | 100% isolated sandbox |
| **Performance** | Faster (no secondary document initialization) | Secondary document loaded |
| **SEO & Accessibility** | Full accessibility tree accessible to parent | Contained in iframe document |

---

## 3. Method A: Native DOM Injection (Recommended)

In this approach, you extract the 3 sections from [v3.html](file:///d:/Z_work/Sujay/Spark%20-%20PMT%20chatbot/v3.html) into your page view or layout template.

### Step 1: External Fonts & Head Assets
Ensure the Google Fonts for **Roboto** and **Roboto Condensed** are included in your page `<head>`:

```html
<!-- Google Fonts for Spark -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@400;600;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
```

### Step 2: Component Stylesheet
Include the CSS from `<style>` in [v3.html](file:///d:/Z_work/Sujay/Spark%20-%20PMT%20chatbot/v3.html) into either your site's stylesheet bundle (e.g., `spark.css`) or directly in a `<style>` tag above `#bodyContent`:

```html
<link rel="stylesheet" href="/css/spark-chatbot.css" />
<!-- OR embed the CSS directly from v3.html (lines 16-1448) -->
```

> **CSS Safety Note**: All styles in [v3.html](file:///d:/Z_work/Sujay/Spark%20-%20PMT%20chatbot/v3.html) are strictly scoped with `.pmt-`, `.spark-`, and `#pmtShell` prefixes to prevent leaking into global site navigation, cards, or footer styles.

### Step 3: Chatbot DOM Placement
In [integration.html](file:///d:/Z_work/Sujay/Spark%20-%20PMT%20chatbot/integration.html) (inside `<section id="bodyContent"> <div class="container py-5">`), replace the old `<div class="spark-embedded-mockup">...</div>` with the following HTML component:

```html
<!-- ========================================== -->
<!-- SPARK CHATBOT EMBEDDED COMPONENT           -->
<!-- ========================================== -->
<div class="pmt-shell open spark-initial" id="pmtShell" role="region" aria-label="Spark, the Pain Management Technologies Assistant">
  
  <!-- Embedded Toolbar -->
  <div class="spark-embed-tools">
    <button class="spark-tool" onclick="window.pmtWidgetActions.openContact()" type="button" title="Talk to a Human">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        style="vertical-align: -2px; margin-right: 4px;">
        <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
      </svg>Talk to a Human
    </button>
    <button class="spark-tool" id="btnClear" type="button">Clear conversation</button>
  </div>

  <!-- Chat Screen & Composer -->
  <div class="pmt-body">
    <div class="pmt-screen home-search-mode" id="screen" role="log" aria-live="polite"></div>
    <div class="composer">
      <div class="composerMain">
        <textarea id="chatInput" rows="1" placeholder="Ask Spark a question"></textarea>
      </div>
      <button class="send" id="btnSend" title="Send message">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round" style="transform: translateX(-1px)">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    </div>
  </div>

  <!-- Contact Form Modal ("Talk to a Human") -->
  <div class="pmt-contact-overlay" id="pmtContactOverlay">
    <div class="pmt-contact-card">
      <div class="pmt-contact-header">
        <h2>Talk to a Human</h2>
        <button class="pmt-contact-close" id="pmtContactClose" title="Close">✕</button>
      </div>
      <form class="pmt-contact-form" id="pmtContactForm" novalidate>
        <div class="pmt-form-row">
          <div class="pmt-form-group">
            <label for="pmtFirstName">First Name</label>
            <input type="text" id="pmtFirstName" placeholder="John" autocomplete="given-name" />
            <span class="pmt-form-error" id="errFirstName"></span>
          </div>
          <div class="pmt-form-group">
            <label for="pmtLastName">Last Name</label>
            <input type="text" id="pmtLastName" placeholder="Doe" autocomplete="family-name" />
            <span class="pmt-form-error" id="errLastName"></span>
          </div>
        </div>
        <div class="pmt-form-group">
          <label for="pmtEmail">Email</label>
          <input type="email" id="pmtEmail" placeholder="john@example.com" autocomplete="email" />
          <span class="pmt-form-error" id="errEmail"></span>
        </div>
        <div class="pmt-form-group">
          <label for="pmtPhone">Phone Number</label>
          <input type="tel" id="pmtPhone" placeholder="(555) 123-4567" autocomplete="tel" />
          <span class="pmt-form-error" id="errPhone"></span>
        </div>
        <div class="pmt-form-group">
          <label for="pmtMessage">Message</label>
          <textarea id="pmtMessage" rows="3" placeholder="How can we help you?"></textarea>
          <span class="pmt-form-error" id="errMessage"></span>
        </div>
        <button type="submit" class="pmt-contact-submit" id="pmtContactSubmit">Submit</button>
      </form>
    </div>
  </div>

</div>
<!-- ========================================== -->
```

### Step 4: JavaScript Logic
Place the `<script>` block from [v3.html](file:///d:/Z_work/Sujay/Spark%20-%20PMT%20chatbot/v3.html) (lines 1529–2754) either:
1. In a standalone file (e.g. `<script src="/js/spark-chatbot.js"></script>`), or
2. Right before the closing `</body>` tag of your template.

The script runs safely on `DOMContentLoaded` and initializes state without polluting global variables (only registers `window.pmtWidgetActions` for modal/interaction hooks).

---

## 4. Method B: Iframe Embedding

If you prefer to maintain 100% CSS and JS isolation without touching existing website scripts, deploy [v3.html](file:///d:/Z_work/Sujay/Spark%20-%20PMT%20chatbot/v3.html) as a standalone HTML page.

### Step 1: Upload the file
Deploy [v3.html](file:///d:/Z_work/Sujay/Spark%20-%20PMT%20chatbot/v3.html) to your server or public CDN path (e.g. `https://paintechnology.com/spark-embed.html` or `/assets/spark/v3.html`).

### Step 2: Replace iframe code in integration.html
In [integration.html](file:///d:/Z_work/Sujay/Spark%20-%20PMT%20chatbot/integration.html) (lines 652–1398), replace the massive encoded `srcdoc` iframe with:

```html
<div class="spark-embedded-mockup" style="max-width: 1000px; margin: 0 auto 38px;">
  <iframe
    src="/spark-embed.html"
    title="Spark Support Chatbot"
    style="width: 100%; height: 780px; border: 0; display: block; border-radius: 18px; background: transparent;"
    loading="lazy"
    allow="clipboard-write">
  </iframe>
</div>
```

---

## 5. Network, CORS & API Endpoints Reference

The component connects to the following live endpoints. Ensure your server's **Content Security Policy (CSP)** and firewalls allow outgoing HTTPS requests:

| Endpoint URL | Method | Purpose |
| :--- | :--- | :--- |
| `https://n8n.srv917960.hstgr.cloud/webhook/spark-chatbot` | `POST` | Live AI completions & conversation stream |
| `https://n8n.srv917960.hstgr.cloud/webhook/session-duration` | `POST` | Chatbot session duration analytics (via `fetch` or `navigator.sendBeacon`) |
| `https://n8n.srv917960.hstgr.cloud/webhook/support-ticket-spark` | `POST` | "Talk to a Human" form ticket dispatch |
|

### Required CSP Headers (if your site enforces CSP)
Add the following to your site's Content-Security-Policy:
```http
connect-src 'self' https://n8n.srv917960.hstgr.cloud ;
img-src 'self' data: https://res.cloudinary.com https://cdn.hmsctl.com https://pmt-new.s3.us-east-1.amazonaws.com;
font-src 'self' https://fonts.gstatic.com;
```

---

## 6. Key Configuration Settings (In JavaScript)

The following constants at lines 1640–1650 of [v3.html](file:///d:/Z_work/Sujay/Spark%20-%20PMT%20chatbot/v3.html) can be configured if endpoints or email addresses change:

```javascript
const CHAT_WEBHOOK_URL = "https://n8n.srv917960.hstgr.cloud/webhook/spark-chatbot";
const SESSION_DURATION_WEBHOOK_URL = "https://n8n.srv917960.hstgr.cloud/webhook/session-duration";
const SUPPORT_TICKET_WEBHOOK_URL = "https://n8n.srv917960.hstgr.cloud/webhook/support-ticket-spark";
const IP_API_URL = "https://api.ipify.org?format=json";
const CONTACT_EMAIL = "customercare@paintechnology.com";
const WARRANTY_URL = "https://paintechnology.com/warranty";
```

### Session Storage Keys
The chatbot uses browser `sessionStorage` to maintain session persistence across reloads without polluting `localStorage`:
- `spark_session_id`: UUIDv4 uniquely identifying the conversation thread.
- `spark_session_start`: Timestamp tracking duration for n8n metrics.

---

## 7. QA & Pre-Deployment Checklist

Before deploying the page to production, verify the following items:

- [ ] **Clean Initial Load**: On page load, only the search box, the 8 categories, and the "Talk to a Human" button are visible. No duplicate headers or chat borders appear.
- [ ] **Home Search Input**: Typing a query into the main search box and pressing `Enter` transitions cleanly into conversation mode with the active message thread and bottom composer.
- [ ] **Category Navigation**: Clicking any category card (e.g., "Pad Placement" or "Getting Started") expands the question list with back navigation and a dedicated "Talk to a Human" CTA.
- [ ] **Talk to a Human Modal**: Clicking "Talk to a Human" (from top toolbar, category cards, or chat buttons) opens `#pmtContactOverlay` with client-side validation (checks name, valid email format, and message).
- [ ] **Live AI Streaming**: Messages successfully reach n8n webhook and stream responses. In case of network timeout, the built-in fallback knowledge base responds smoothly.
- [ ] **Clear Conversation**: Clicking "Clear conversation" in the toolbar resets the thread back to the initial homepage view and clears the current history.
- [ ] **Mobile Responsiveness**: Test at mobile viewport widths (< 576px). Verify modal fits on screen and the composer bar stays accessible.
- [ ] **Videos & Resources Intact**: Verify the Ultima 5 instructional video, VA TENS device video, and the resources link below the chatbot render correctly without visual clipping.
