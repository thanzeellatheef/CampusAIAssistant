# Deploy: Render + TiDB + R2

This setup uses one Render Docker web service for the React app and Express API, TiDB Cloud Starter for MySQL-compatible data, and Cloudflare R2 for uploaded PDFs.

## Cost and reliability

This is a low-traffic hobby deployment, not a production availability guarantee. Render Free services sleep after 15 minutes without inbound traffic and can take about a minute to wake. They have an ephemeral filesystem and no persistent disk, so PDFs must use R2. Free service hours and provider limits apply.

Cloudflare R2 currently includes 10 GB-month of Standard storage, 1 million Class A operations, and 10 million Class B operations per month, with free egress. Usage beyond the free allowance can incur charges. TiDB Starter has its own quotas and limits. Check provider pricing before launch; this combination is not a guaranteed $0 plan.

## 1. Create TiDB Cloud Starter

1. Create a TiDB Cloud Starter instance.
2. In TiDB's **Connect** dialog, create/save a database password and copy the endpoint, port, database name, and full TiDB username (including its required cluster prefix).
3. Allow network access from the Render service as required by TiDB's access controls.
4. Keep TLS enabled. TiDB Starter requires TLS for public connections; this app verifies server certificates when `DB_SSL=true`.

The app's database user must not be `root`. Use the non-root user provided by TiDB Starter, with its generated password.

## 2. Create R2 bucket and API credentials

1. Create a Cloudflare R2 bucket using Standard storage.
2. Create an R2 S3 API token with object read/write permissions scoped to this bucket.
3. Record the S3 endpoint (`https://<account-id>.r2.cloudflarestorage.com`), bucket name, access key ID, and secret access key. Store them in Render secrets only.

The service uses S3-compatible object operations. PDFs remain in R2 across Render sleep/restarts/redeploys; TiDB stores document metadata and embeddings.

## 3. Deploy the GitHub repository on Render

1. In Render, choose **New > Blueprint** and connect the GitHub repository `ArkaanSayed/CampusAIAssistant` on branch `main`.
2. Render will read the root `render.yaml` and deploy the root `Dockerfile` as a Docker web service.
3. Keep the service on the `free` plan for the trial/hobby setup. No Render disk is needed because PDFs are in R2.
4. The Blueprint uses `dockerCommand: npm run db:release && npm start`. Free Render does not support pre-deploy one-off jobs, so this idempotent migration/admin-seed command runs at service startup. It is safe to rerun: migrations are tracked and the admin seeder skips an existing admin.
5. The frontend and API share one HTTPS origin. Render's health check is `/api/v1/health`.

If Render reports the service name/subdomain differs from the intended name, set `CORS_ORIGIN` to the exact HTTPS URL shown by Render, with no trailing slash, then save and redeploy.

## 4. Set Render environment variables

The Blueprint prompts for variables marked `sync: false`. Set these in Render's service environment. Do not copy values from the local `.env`, commit credentials, or send secrets in chat.

```dotenv
NODE_ENV=production
DB_SSL=true
DB_HOST=<TiDB host>
DB_PORT=4000
DB_NAME=<TiDB database name>
DB_USER=<full TiDB username including cluster prefix>
DB_PASSWORD=<TiDB password>
JWT_SECRET=<unique random secret at least 32 characters>
GEMINI_API_KEY=<new rotated Gemini API key>
ADMIN_EMAIL=<initial admin email>
ADMIN_PASSWORD=<unique initial admin password at least 8 characters>
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=<R2 bucket name>
S3_ACCESS_KEY_ID=<R2 access key ID>
S3_SECRET_ACCESS_KEY=<R2 secret access key>
CORS_ORIGIN=https://<exact-render-service-domain>
```

The Render Blueprint generates `JWT_SECRET`. Replace any leaked Gemini key before deploying. `DOCUMENT_STORAGE_DIR` is only used for local development and is not required in production.

## 5. Verify deployment

- Wait for Render's first deploy to report healthy. The first request after idle may take about a minute while the free service wakes.
- Open `https://<service-domain>/api/v1/health`; expect `{"status":"ok"}`.
- Sign in with the initial admin account.
- Create the academic setup, faculty, student accounts, and assignments.
- Upload a small test PDF as faculty. Confirm it becomes `READY`, then let the service restart/sleep and verify the material remains listed.
- Sign in as a student with access to that course, ask a question, and confirm the answer cites the uploaded material.
- Check TiDB and R2 quotas/usage periodically; configure billing alerts or limits with each provider.

## Known limitations

- Free Render services sleep when idle and may be restarted; cold starts delay the first request.
- R2 free allowance is quota-limited. Requests/storage beyond included usage may cost money.
- TiDB Starter is an external public database endpoint; use its TLS-required connection and strong generated password.
- The current service processes PDF embeddings synchronously during uploads. Large PDFs or Gemini rate limits can make an upload slow or fail; use small PDFs for the free deployment.
- The initial admin is created automatically at startup from `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Do not run the demo seeder in this environment.
