# Martha Kolleh — Player Profile Site (with Admin Panel)

A Node.js site with a public player profile page and a login-protected
`/admin` panel where you can update her bio, add stats, and upload photos
and reels — all from a phone browser, no code editing required.

**Important — this was built and syntax-checked in a sandbox with no
internet access, so it could not be run live before being handed to you.**
Follow the "Test it locally first" steps below before deploying, so you can
catch and fix anything before it's public.

## 1. Install dependencies

You need [Node.js](https://nodejs.org) (v18+) installed on whatever machine
you run this on first (your own laptop, or directly on the Droplet).

```bash
cd martha-kolleh-admin
npm install
```

## 2. Configure your login

```bash
cp .env.example .env
npm run set-password
```

This asks you to type a password, then prints an `ADMIN_PASSWORD_HASH` line —
paste that into your `.env` file. Also set `ADMIN_USERNAME` in `.env` to
whatever username you want, and generate a `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste that value in as `SESSION_SECRET`. Your real password itself is never
stored anywhere — only its hash.

## 3. Test it locally first

```bash
npm start
```

Then open `http://localhost:3000` in a browser — that's the public page.
Open `http://localhost:3000/admin/login` and sign in with the username/
password you just set — that's the control panel. Try editing the bio,
adding a stats row, and uploading a photo. Confirm each change shows up on
the public page before you deploy anywhere.

## 4. What you can do from `/admin`

- **Bio & Basic Info** — name, positions, DOB, place of birth, county of
  origin, nationality, height, foot, current club, contract, summary
- **National Team** — caps, debut, goals, note
- **Career Timeline** — add/remove club history steps, mark which is current
- **Season Statistics** — add/delete rows in the stats table
- **Photo Gallery** — upload new photos directly, delete old ones
- **Reels** — upload video files directly (MP4/WEBM/MOV, up to 150MB) or
  paste a link to a reel hosted elsewhere (YouTube, Instagram, TikTok)
- **Scouting Contact Info** — email, WhatsApp, based-in location

Everything saves to `data/site-data.json` and appears on the public page
immediately — no rebuild step, no re-uploading files.

## 5. Deploying to DigitalOcean

```bash
# On your Droplet (Ubuntu 24.04):
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs nginx

# Upload the whole martha-kolleh-admin folder to the server, e.g.:
scp -r ./martha-kolleh-admin root@YOUR_DROPLET_IP:/var/www/marthakolleh

# SSH in, then:
cd /var/www/marthakolleh
npm install
cp .env.example .env   # then edit .env with real values as in step 2

# Keep the server running permanently with pm2:
sudo npm install -g pm2
pm2 start server.js --name martha-site
pm2 startup
pm2 save
```

Then set up Nginx as a reverse proxy so the site is reachable on port 80/443
instead of exposing port 3000 directly:

```nginx
# /etc/nginx/sites-available/marthakolleh
server {
    listen 80;
    server_name marthakolleh.com www.marthakolleh.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    client_max_body_size 160M;  # allow video uploads through
}
```

```bash
sudo ln -s /etc/nginx/sites-available/marthakolleh /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Free HTTPS:
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d marthakolleh.com -d www.marthakolleh.com
```

After Certbot runs, open `server.js` and uncomment the `secure: true` line
in the session cookie config, then restart: `pm2 restart martha-site`.

## 6. Security notes — please actually read this

- Anyone who gets your admin password can edit or delete everything on the
  site. Use a real password (the script requires 8+ characters, but longer
  and random is much better), and don't share the `.env` file with anyone.
- `/admin` is not linked from the public site and isn't in the sitemap, but
  it isn't secret either — assume anyone could find the URL. The login is
  what actually protects it.
- Back up `data/site-data.json` and the `public/uploads/` folder
  periodically (e.g. `scp` them down to your phone/laptop) — if the Droplet
  ever has an issue, that's everything: her bio, stats, photos, and reels.

## 7. After launch — helping Google find it

- Submit the site in **Google Search Console** (free) and submit
  `/sitemap.xml` there.
- Keep her name and this domain consistent anywhere else she's listed
  (Transfermarkt, LFA, social media) — that consistency is what helps
  Google treat this as the authoritative "who is Martha Kolleh" answer.
