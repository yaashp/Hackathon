# DevSight AI

DevSight now includes a full-stack local debugging workspace alongside the repository's original standalone visual-audit prototype. The full-stack workspace provides local browser evidence, a source-aware fix review, post-fix verification, and DebugQuest learning missions with progressive hints and XP.

The existing standalone prototype remains available from the repository root as `index.html`, `styles.css`, and `app.js`.

## Run the full-stack app on Windows

Install Python 3.11, Node.js, and Git. Clone the repository, then open PowerShell in the project folder:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\run.ps1
```

Open http://127.0.0.1:8000. PowerShell's execution-policy bypass above applies only to the invoked process; it does not change the machine policy.

In a second PowerShell window, start the seeded Next.js sample:

```powershell
cd sample-next
npm install
npm run dev
```

Then click **Run audit** in DevSight. The sample has three seeded runtime errors and is labeled as a practice project. To inspect another supported app, enter its local folder and localhost URL in DevSight.

## Enable Gemma

Copy `.env.example` to `.env`, add your own Google AI Studio key, and keep `.env` private. Never commit API keys.

## Original standalone prototype

To run the original static prototype instead, serve the repository root with:

```powershell
py -m http.server 8080
```

Open http://127.0.0.1:8080.

## Privacy and scope

The full-stack development server binds to loopback by default. Browser screenshots and source excerpts stay local unless model analysis is enabled. Review each suggested patch; DevSight makes a backup before writing and only describes a fix as verified after rerunning its check.
