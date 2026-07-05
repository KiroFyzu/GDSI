# Changelog

## 2026-07-06

### Added

- Added Paywuz donation API endpoint at `/api/donation` for creating donation transactions and checking payment status without Google Apps Script.
- Added Paywuz webhook endpoint at `/api/webhook` with `X-Paywuz-Signature` verification.
- Added donation payment method selection for `QRIS` and `Virtual Account`.
- Added local Vite middleware so `/api/donation` works during `npm run dev`.
- Added Paywuz setup documentation in `PAYWUZ-DONATION.md`.

### Changed

- Donation flow now uses Vercel serverless functions instead of Google Apps Script for Paywuz transactions.
- Donation status handling now treats both `success` and `settlement` as successful payments.
- Failed status checks now show the pending state instead of immediately showing donation failed.
- API response parsing on the donation page now handles empty or invalid responses with clearer errors.

### Configuration

- Added server-only Paywuz environment variables to `.env.example`: `PAYWUZ_API_KEY`, `GDSI_SITE_URL`, and `PAYWUZ_BASE_URL`.
