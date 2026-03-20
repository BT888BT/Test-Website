# FDM Print Quote Site

A simple, static quote-request form for FDM 3D printing services.  
Users upload an STL file + fill in contact & print details → submission is saved as a **Netlify Form** entry.

---

## Project structure

```
fdm-quote-site/
├── index.html      ← Main page + form
├── style.css       ← All styles
├── app.js          ← Validation, safety checks, form submission
├── netlify.toml    ← Netlify config + security headers
└── README.md
```

---

## Deploy to GitHub + Netlify (step by step)

### 1 — Create a GitHub repository

1. Go to [github.com](https://github.com) and sign in.
2. Click **New repository**.
3. Name it (e.g. `fdm-quote-site`), set to **Public** or **Private**, then click **Create repository**.
4. On your computer, open a terminal in this project folder and run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/fdm-quote-site.git
git push -u origin main
```

### 2 — Connect to Netlify

1. Go to [app.netlify.com](https://app.netlify.com) and sign in (free account is fine).
2. Click **Add new site → Import an existing project**.
3. Choose **GitHub** and authorise Netlify.
4. Select your `fdm-quote-site` repository.
5. Build settings — leave everything blank (this is a plain static site):
   - **Build command:** *(empty)*
   - **Publish directory:** `.`
6. Click **Deploy site**.

Netlify will give you a live URL like `https://amazing-name-12345.netlify.app`.

### 3 — Enable Netlify Forms (automatic)

Netlify Forms is already wired up in `index.html` via `data-netlify="true"`.  
After your first deploy:

1. In your Netlify dashboard, go to **Forms**.
2. You'll see the `quote-request` form listed automatically.
3. To get email notifications for each submission: **Forms → quote-request → Form notifications → Add notification → Email**.

### 4 — (Optional) Add a custom domain

1. In Netlify: **Domain settings → Add custom domain**.
2. Follow the DNS instructions for your registrar.

---

## What the safety checks do

The client-side STL safety checks run before submission:

| Check | What it does |
|---|---|
| Extension | Rejects anything that isn't `.stl` |
| File size | Rejects files over 50 MB |
| Filename | Rejects names with special/dangerous characters |
| STL content | Reads the first 256 bytes; detects ASCII vs binary STL signatures |
| Null-byte injection | Flags null bytes in ASCII STL headers (injection attempt indicator) |

All checks must pass before the submit button is enabled.

---

## Customising

- **Max file size** → change `MAX_FILE_SIZE_MB` in `app.js`
- **Material list** → edit the `<select>` options in `index.html`
- **Colours / brand** → edit CSS variables at the top of `style.css`
- **Email notifications** → configure in the Netlify dashboard under **Forms**
