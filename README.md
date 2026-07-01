diff --git a/README.md b/README.md
index 3f51556bdac43f16bf115da8792db6ab1c5d1532..2e2e7908d9dd2a919880b81e2415ea1691448ee0 100644
--- a/README.md
+++ b/README.md
@@ -1,10 +1,38 @@
-- 👋 Hi, I’m @AndreDaGOAT
-- 👀 I’m interested in programming, data analystics, AI coding..
-- 🌱 I’m currently learning Python, AI coding enhancements...
-- 💞️ I’m looking to collaborate on GIS integrations, python best practices, AI enhancing...
-- 📫 How to reach me aarmstrong1234@gmail.com...
-
-<!---
-AndreDaGOAT/AndreDaGOAT is a ✨ special ✨ repository because its `README.md` (this file) appears on your GitHub profile.
-You can click the Preview link to take a look at your changes.
---->
+# The Teacher Coach LLC Website
+
+A responsive, static-first website for The Teacher Coach LLC, focused on literacy leadership, instructional coaching, and school consulting.
+
+## Project Goals
+
+- Deploy easily to GitHub Pages with no build step.
+- Keep HTML, CSS, and JavaScript modular for future expansion.
+- Prepare clean integration points for Supabase, Google Cloud Run, Cloud Storage, Cloud Functions, and Vertex AI.
+- Maintain accessibility, SEO, and performance as first-class requirements.
+
+## Structure
+
+```text
+.
+├── index.html                  # Landing page
+├── assets/
+│   ├── css/styles.css          # Mobile-first design system and components
+│   ├── images/                 # Placeholder brand and page imagery
+│   └── js/main.js              # Small vanilla JavaScript enhancements
+├── database/supabase.js        # Placeholder Supabase initialization module
+├── pages/                      # Future blog, auth, portal, and resources areas
+└── cloud/                      # Future Google Cloud service notes
+```
+
+## Local Preview
+
+Open `index.html` directly in a browser or serve the folder with a lightweight static server:
+
+```bash
+python3 -m http.server 8000
+```
+
+Then visit `http://localhost:8000`.
+
+## Environment Variables
+
+Do not commit live service keys or project secrets. Future deployments should inject Supabase and cloud configuration through the hosting environment.

