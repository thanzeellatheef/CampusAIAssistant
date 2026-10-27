# Deploy to Railway

The repository is packaged as one Docker service: Express serves both `/api/v1` and the built React app from one HTTPS origin. Railway configuration runs migrations and seeds only the initial admin before deployment, and checks `/api/v1/health`.

The Docker image was built locally and smoke-tested: health returned `200`, and `/login` served the frontend. The backend suite passes 31 tests. No Railway project is linked from this workspace, so the first project creation and secret entry must be done in the Railway dashboard or after authenticating the Railway CLI.

## 1. Create Railway project

1. In Railway, create a project and add a MySQL database service.
2. Add this repository as a service from GitHub, with the repository root as the build context. Railway detects the root `Dockerfile` and `railway.json`.
3. Ensure the web service uses the Dockerfile and has a public domain enabled. The app serves the frontend and API on that same domain.
4. Attach a persistent volume to the web service mounted at `/var/lib/campus`. Set `DOCUMENT_STORAGE_DIR=/var/lib/campus/course-documents`.
5. Keep the web service to one replica unless uploads are moved to shared object storage. Local persistent volumes are not shared across replicas.

## 2. Configure variables

Name the database service `MySQL` or change the service reference names below to match. Add these variables to the web service. Railway's reference syntax keeps the private database credentials out of Git.

The Railway MySQL template account may be `root`, which the app intentionally rejects for production. Connect to the MySQL service once with its generated administrative credentials and create a dedicated app account. Replace the placeholders with your generated database name and a new password, and run this SQL in the MySQL console:

```sql
CREATE USER 'campus_app'@'%' IDENTIFIED BY '<unique-app-database-password>';
GRANT ALL PRIVILEGES ON `<production-database>`.* TO 'campus_app'@'%';
```

Use `campus_app` and that new password for the web service's `DB_USER` and `DB_PASSWORD`; do not reference the template's root credentials there.

```dotenv
NODE_ENV=production
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
JWT_SECRET=<unique-random-secret-at-least-32-characters>
GEMINI_API_KEY=<new-rotated-provider-key>
ADMIN_EMAIL=<initial-admin-email>
ADMIN_PASSWORD=<unique-initial-admin-password>
DOCUMENT_STORAGE_DIR=/var/lib/campus/course-documents
CORS_ORIGIN=https://${{RAILWAY_PUBLIC_DOMAIN}}
```

For Railway's MySQL template, verify the generated database variable is named `MYSQLDATABASE`; if the template exposes `MYSQL_DATABASE` instead, use that exact name in the reference. Generate the web service's public domain before deploying so `RAILWAY_PUBLIC_DOMAIN` resolves. The frontend and API share the domain and the frontend calls `/api/v1`, so no separate frontend API URL is required. Do not put secret values in Git or chat.

The production server rejects default/demo secrets, root/empty-password database credentials, non-HTTPS origins, a missing Gemini key, and an unset/non-absolute document-storage path. The current `.env` is local development configuration and must not be deployed.

## 3. Deploy and initialize

Railway's pre-deploy command runs `npm run db:release`, which applies migrations and creates the configured initial admin only if it does not already exist. It deliberately does not run the demo academic seeder. Create academic years, courses, faculty, students, and assignments through the admin UI after first login.

The container start command is `node dist/server.js`; Railway supplies the listening `PORT`. The health check is `/api/v1/health`.

## 4. Verify launch

- Confirm the deployment is healthy and `https://<domain>/api/v1/health` returns `200`.
- Sign in as the initial admin over HTTPS, then verify faculty and student accounts.
- Upload a test PDF, wait for `READY`, and verify it remains listed after a redeploy/restart.
- Ask a question grounded in that PDF and confirm the answer cites it.
- Verify database backups and uploaded-volume backups can be restored.
- Rotate any credentials that have been shared outside the provider's secret manager.

## Important storage constraint

Railway's attached volume provides persistence for a single service instance, not shared storage across multiple replicas. For horizontal scaling, replace local PDF storage with a shared S3-compatible object store and use it for upload, delete, and retrieval before adding replicas.