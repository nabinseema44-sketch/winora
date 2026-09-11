# Winora production cleanup

## Production data policy

Winora must never seed demo players, demo wallets, demo referral relationships, demo game entries, demo balances, or demo ledger transactions in the production runtime.

All player identity and wallet state must come from the authenticated backend/Firebase data source. A newly registered player starts with zero Main Wallet and zero Bonus Wallet.

Automated tests must create their own isolated test fixtures and must not be loaded by the production application startup path.

## Deployment invariant

The production process must not execute test seeders or demo initialization. Runtime persistence must use the configured backend data store; local JSON files are not an authoritative production wallet database.
