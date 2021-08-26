# Anchor Borrow / Repay bot

The main goal of this bot is to avoid being liquidated due to the price volatility of bLuna, by repaying part of your debt when the LTV is too high.

> :warning: You will need to **use your private key** to let the bot create and sign transactions.
> We highly recommend to **create a dedicated wallet** and **we decline all responsibility if you lose any money**.

In case you need help or wanna get updates, feel free to join our [Telegram Group](https://t.me/joinchat/QSb-eRhnCmw0MDM0).

<br />

## How it Works?

The bot will fetch your current LTV every X seconds (10 per default).

If your LTV is higher than `ltv.limit` (53% per default), the bot will try to repay the sum needed to make your LTV back at `ltv.safe` (45% per default).

1. We verify the balance of your wallet to see if you have enough money to repay;
2. We verify the balance of your deposit to see if you can withdraw from it to repay;
3. We verify if you have any unclaimed reward that we can claim and sell to repay;
4. :construction: We verify if you have any token stake in governance that we can unstake and sell to repay ([#3](https://github.com/RomainLanz/anchor-borrow-bot/issues/)).

> :information_source: If we need to claim any rewards, we will sell only the required amount and stake in governance the rest of your token.

If your LTV is lower than `ltv.borrow` (40% per default) and the option is activated, the bot will borrow more to reach the `ltv.safe` (45% per default), then it will deposit the amount borrowed.

<br />

## Installation

You will need to have `Node.js` installed on your system to run this bot.
We highly recommend you to use [`volta.sh`](https://volta.sh/) or [`nvm`](https://github.com/nvm-sh/nvm) to manage your `Node.js` version.

> :information_source: The bot has been tested with Node.js 16.2.0, on Windows, Linux & macOS.

Once you have `node` and `npm` accessible in your terminal's path, you will need to do the following:

1. Clone the repository;
2. Install its dependencies (`npm install`);
3. Copy the `.env.example` file to `.env` and fill all values (`cp .env.example .env`);
4. Run the bot with `npm run start`.

> :information_source: We recommend using a tool like [`pm2`](https://github.com/Unitech/pm2) to run the bot in a background process.

<br />

## Setup Telegram Bot

This bot will notify you via a Telegram Bot for any transactions.

You need to create your Telegram Bot to activate this feature. It can be quickly done [via the Telegram application](https://core.telegram.org/bots#6-botfather).
Once you have your `token` and your `chat_id` you can define those variables inside the `.env` file.

> :information_source: The `chat_id` is your user ID. You can have it when sending `/getid` to [IDBot](https://t.me/myidbot).

You will also be able to control the bot via some commands.

- `/ping` - Will answer you `Pong!`;
- `/ltv` - Will give you your current LTV;
- `/goto X` - Will repay or borrow to change your LTV according to X;
- `/set X Y` - Will change runtime configuration (ie: `/set ltv.borrow 20`);
- `/run` - Start the bot if it's paused;
- `/pause` - Pause the bot, clear all caches and queues;
- `/info` - Display current status and config;
- `/compound X` - Compound your rewards by selling them, swapping them to UST > Luna, bonding to bLuna and providing them (`X` can be `earn` or `borrow`).

### Changeable runtime settings (`/set`)

| path                     | Description                                                     | Accept  |
| ------------------------ | --------------------------------------------------------------- | ------- |
| ltv.borrow               | At which LTV the bot should borrow more                         | Number  |
| ltv.limit                | At which LTV the bot should repay                               | Number  |
| ltv.safe                 | At which LTV the bot should go when borrowing or repaying       | Number  |
| options.shouldBorrowMore | Define if the bot should borrow more when reaching `ltv.borrow` | Boolean |

<br />

## Issues

- If you have any issues with the bot, please, feel free to create one on this repository.
- If the bot is stuck in `Already running, please retry later`, you can safely start it again by running `/pause` followed by `/run` (The bot should automatically restart if it's stuck).

<br />

## Testing

If you would like to try the bot before running in production, you may want to use the Terra Testnet.
You can add fake money to your Testnet Wallet using https://faucet.terra.money/.

<br />

## Tips

If you want to send any tips, you can send them to `terra17lkkhegetxqua7s7g7k3xr9hxzcpvf8p878cnl`.

<br />

## Changelogs

### 0.2.9

- Remove the cache since it seems to cause issue for some people.
- Increase gas price for pre Columbus-5 update.
- Increase gas adjustement to avoid `out-of-gas` error.

### 0.2.8

- Fixed LTV computing since Borrow Limit is now at 60%.

### 0.2.7

**NOTE**: Ensure to remove the `# B-Harvest` after the validator address in your `.env` file.

- Fixed security issue where other people could control the bot via Telegram
- Fixed how we pay the fee when having multiple stablecoins in the wallet (Thanks to [@etienne-napoleone](https://github.com/etienne-napoleone))
- Fixed the `/compound` method (Thanks to [@luigi311](https://github.com/luigi311));
- Fixed the `PAUSE` mode that may not work;
- Verify that the bot is not in pause or running for compounding;
- Added configuration of LTV & compound minimum via environment variable;
- Added `earn` & `borrow` option to the `/compound` command;
- Added verification of `path` & `value` when using `/set`.

### 0.2.6

- **BREAKING** : Renamed `KEY` to `MNEMONIC` in `.env` file';
- Added `/compound` command (ensure to copy `VALIDATOR_ADDRESS` from the `.env.example`);
- Added `/run`;
- Added `/pause`;
- Added `/info`;
- Added some safety for `/goto` and `/set`;
- Verify environements variables at start;
- Verify values when using `/set`;
- Reboot the bot when it fails 5 times.
