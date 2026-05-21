# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv@0.15.1 create --template minimal --types ts --install npm .
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Deployment: panel vs visitor domains

This app serves two roles from one Node process:

- **Admin panel** — only on the hostname set in `PANEL_HOST` (e.g. `345235fgdfgdgdgdgd.shop`). Login, dashboard, and all operator routes live here.
- **Visitor pages** — any hostname registered in the Domains tab (e.g. `972163.com`). Paths like `/loading` render the matching visitor template. The admin panel is never exposed on these domains.

Copy `.env.example` to `.env` and set `PANEL_HOST` to your panel domain before building:

```sh
cp .env.example .env
# edit PANEL_HOST=your-panel-domain.shop
# If behind Cloudflare, also set ADDRESS_HEADER=CF-Connecting-IP
npm run build
node build/index.js
```

When `PANEL_HOST` is unset, all hostnames use the admin-panel behavior (useful for local dev on `localhost`).
