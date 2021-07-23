export default {
	// This should be your wallet mnemonic (24 words).
	mnemonic: process.env.MNEMONIC,

	// This is Terra Blockchain information
	lcdUrl: process.env.LCD_URL,
	chainId: process.env.CHAIN_ID,

	// Telegram Bot information
	telegram: {
		apiKey: process.env.BOT_API_KEY,
		userId: process.env.BOT_CHAT_ID,
	},

	options: {
		// This define if the bot should borrow more
		shouldBorrowMore: true,

		// This define the number of SECONDS to wait between each verification.
		waitFor: 15,
	},

	ltv: {
		// This define the limit when the bot will repay your debt.
		limit: process.env.LTV_LIMIT || 53,

		// This define the safe-limit that the bot will reach when repaying or borrowing more.
		safe: process.env.LTV_SAFE || 45,

		// This define the low-limit when the bot will borrow more.
		borrow: process.env.LTV_BORROW || 40,
	},

	compoundMins: {
		// This defines the minimum required for compound to swap ANC for Luna
		anc: process.env.COMPOUND_ANC || 5,

		// This defines the minimum required for compound to swap Luna for bluna
		luna: process.env.COMPOUND_LUNA || 5,

		// This defines the minimum required for compound to add the bluna into borrow
		bluna: process.env.COMPOUND_BLUNA || 5,
	},

	notification: {
		tty: true,
		telegram: true,
	},
}
