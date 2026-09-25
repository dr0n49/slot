# NITRO VEIN — production build

    cd nitro-vein-prod && node dev/serve-prod.mjs

Open the printed https://localhost:4173/... URL (self-signed certificate: accept the warning once).
Needs only Node 18+ and openssl. The RGS here is a local mock that plays real math-sdk books; a real deployment
uploads the contents of build/ to Stake Engine instead.
