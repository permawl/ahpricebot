# WoW Telegram Price Bot for Netlify

This bot uses Undermine Exchange EU commodity binary data for:
- Refulgent Copper Ore
- Umbral Tin Ore
- Brilliant Silver Ore
- Azeroot
- Argentleaf
- Nocturnal Lotus

## Deploy steps

1. Create a new GitHub repo and upload this project.
2. In Netlify, import the repo.
3. Add this environment variable in Netlify:
   - `TELEGRAM_BOT_TOKEN` = your Telegram bot token
4. Deploy the site.
5. Open your deployed site root URL once. It redirects to the setup function and registers the Telegram webhook.
6. Open Telegram and send `/start` to your bot.

## Notes

- This bot reads EU commodity data from Undermine Exchange, which is appropriate for these stackable ores/herbs.
- Prices are shown as current lowest auction price.
- No database is required.
