# PrimeLot / Wicked Card Tracker import architecture

## Target architecture

Wicked Card Tracker should not own PrimeLot's final listing database writes long term.

When PrimeLot exposes a server-to-server import endpoint, WCT should POST `multipart/form-data` to PrimeLot, and PrimeLot should own:

- final database insert/update
- duplicate checking
- PrimeLot seller membership rules
- draft vs live messaging
- section routing and validation

Expected endpoint shape:

- URL: `https://primelot.cards/api/wickedcardtracker/import`
- Auth: shared server secret/header, not a browser PrimeLot session cookie
- Method: `POST`
- Body: `multipart/form-data`

Required form fields:

- `file`: CSV/import file
- `cardType`: `sports` | `pokemon` | `one_piece`
- `listingType`: `single_card` | `sealed_product` | `lot`
- PrimeLot user identifier, preferably PrimeLot user id or seller email

Required listing type mapping:

- `single_card` -> single card draft
- `sealed_product` -> sealed product draft
- `lot` -> lot draft

Sealed boxes, booster packs, tins, cases, and other unopened products should use `sealed_product`, not `single_card`.

## Temporary fallback

Until PrimeLot supports server-to-server WCT imports, WCT may directly insert into PrimeLot Supabase as a temporary fallback only.

Fallback requirements:

- always insert `status = "draft"`
- never directly insert active/live listings
- preserve mapping:
  - `single_card` -> `single_cards`
  - `sealed_product` -> `sealed_products`
  - `lot` -> `lots`
- continue requiring explicit `listingType` from the user
- continue preparing multipart `FormData` with `file`, `cardType`, and `listingType` so the switch to PrimeLot's endpoint stays straightforward
