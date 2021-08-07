require('dotenv').config()
import { Telegraf } from 'telegraf'
import config from './config'
import { Bot } from './src/Bot'
import { Logger } from './src/Logger'

const bot = new Bot(config)

if (config.telegram.apiKey) {
	const tgBot = new Telegraf(config.telegram.apiKey)

	tgBot.command('ping', (ctx) => ctx.reply('Pong!'))

	tgBot.command('info', (ctx) => {
		if (ctx.chat.id !== +config.telegram.userId) {
			ctx.reply('fuck off')
			return
		}

		bot.info()
	})

	// tgBot.command('repay', async (ctx) => {
	// 	ctx.replyWithHTML('<b>PANIC MODE</b>: Repaying everything and stopping the bot.')
	// 	await bot.repay()
	// 	bot.pause()
	// })

	tgBot.command('run', (ctx) => {
		if (ctx.chat.id !== +config.telegram.userId) {
			ctx.reply('fuck off')
			return
		}

		bot.run()
	})

	tgBot.command('pause', (ctx) => {
		if (ctx.chat.id !== +config.telegram.userId) {
			ctx.reply('fuck off')
			return
		}

		bot.pause()
	})

	tgBot.command('compound', (ctx) => {
		if (ctx.chat.id !== +config.telegram.userId) {
			ctx.reply('fuck off')
			return
		}

		const [, type] = ctx.message.text?.split(' ')

		if (!['borrow', 'earn'].includes(type)) {
			ctx.reply('You can only use this command with "borrow" or "earn" parameter')
			return
		}

		bot.compound(type as 'borrow' | 'earn')
	})

	tgBot.command('ltv', async (ctx) => {
		if (ctx.chat.id !== +config.telegram.userId) {
			ctx.reply('fuck off')
			return
		}

		const message = await ctx.replyWithHTML('Loading...')
		const ltv = await bot.computeLTV()
		ctx.telegram.editMessageText(
			message.chat.id,
			message.message_id,
			undefined,
			`Your LTV is <code>${ltv.toFixed(3)}%</code>`,
			{ parse_mode: 'HTML' }
		)
	})

	tgBot.command('set', (ctx) => {
		if (ctx.chat.id !== +config.telegram.userId) {
			ctx.reply('fuck off')
			return
		}

		const [, path, value] = ctx.message.text?.split(' ')

		if (!path || !value) {
			ctx.reply('Send a path or value')
			return
		}

		bot.set(path, value)
	})

	tgBot.command('goto', async (ctx) => {
		if (ctx.chat.id !== +config.telegram.userId) {
			ctx.reply('fuck off')
			return
		}

		const [, amount] = ctx.message.text.split(' ')

		if (isNaN(+amount)) {
			ctx.reply('Send a correct number')
			return
		}

		ctx.replyWithHTML(`Going to <code>${amount}%</code>`)
		await bot.execute(+amount, 'tgBot')
	})

	tgBot.catch((e) => {
		// @ts-expect-error Typing
		if (e.response) {
			// @ts-expect-error Typing
			console.error('[Error Telegraf]', e.response)
		} else {
			console.error('[Error Telegraf]', e)
		}
	})

	tgBot.launch()
}

async function main() {
	try {
		await bot.execute()
	} catch (e) {
		if (e.response) {
			Logger.log(`An error occured\n${e.response?.data}`)
		} else {
			Logger.log(`An error occured\n${e}`)
		}

		bot.clearQueue('main')
		bot.stopExecution()
		Logger.clearChannel('main')
	} finally {
		bot.clearCache()
	}

	setTimeout(main, config.options.waitFor * 1000)
}

if (process.env.MNEMONIC && process.env.MNEMONIC.split(' ').length !== 24) {
	throw new Error('Invalid mnemonic key provided.')
}

if (process.env.LCD_URL && !process.env.LCD_URL.startsWith('https://')) {
	throw new Error('Invalid LCD URL provided.')
}

if (process.env.CHAIN_ID && process.env.CHAIN_ID.split('-').length !== 2) {
	throw new Error('Invalid CHAIN ID provided.')
}

if (config.ltv.limit > 59) {
	throw new Error('ltv.limit is too high.')
}

if (config.ltv.safe >= config.ltv.limit) {
	throw new Error('ltv.safe is too high.')
}

if (config.ltv.borrow >= config.ltv.safe) {
	throw new Error('ltv.borrow is too high.')
}

main()
