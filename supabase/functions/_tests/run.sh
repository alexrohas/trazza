#!/usr/bin/env sh
# Tests de las Edge Functions. Cada funcion se ejecuta con su import map, que cambia
# npm:stripe y npm:@supabase/supabase-js por los simulados de mocks/. Por eso van con
# --no-check: los simulados no tienen los tipos de Stripe; los tipos de las funciones de
# verdad los comprueba `deno check` aparte (ver .github/workflows/ci.yml).
#
#   sh supabase/functions/_tests/run.sh
#
# Sin Deno instalado: DENO="npx -y deno@2.9.6" sh supabase/functions/_tests/run.sh
set -e
cd "$(dirname "$0")"
DENO="${DENO:-deno}"
$DENO test --allow-env --allow-read --no-check --import-map=webhook.import_map.json stripe-webhook.test.ts
$DENO test --allow-env --allow-read --no-check --import-map=delete.import_map.json delete-account.test.ts
