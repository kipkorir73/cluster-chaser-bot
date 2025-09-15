# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/d1725c80-d7ca-48c5-af10-92905e3484c0

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/d1725c80-d7ca-48c5-af10-92905e3484c0) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/d1725c80-d7ca-48c5-af10-92905e3484c0) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## Configure Deriv API token (live data)

To receive live data and authorize with Deriv, set your API token using either method below.

1) Local development (.env)

Create a file named `.env` in the project root with:

```
VITE_DERIV_API_TOKEN=your_deriv_api_token_here
```

Then run the dev server:

```
npm run dev
```

2) Netlify function environment variable (production)

If deploying on Netlify, add an environment variable in your site settings:

- Key: `VITE_DERIV_API_TOKEN`
- Value: your Deriv API token

The frontend will first try `/.netlify/functions/get-token`, which returns this token. If the function is unavailable, it falls back to `import.meta.env.VITE_DERIV_API_TOKEN`.

Security note: Never hardcode tokens in code or commit `.env` files.
