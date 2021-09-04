import { dset } from 'dset'
import dedent from 'dedent-js'
import Decimal from 'decimal.js'
import {
	Coin,
	Denom,
	LCDClient,
	MnemonicKey,
	Msg,
	MsgExecuteContract,
	MsgSwap,
	StdFee,
	Wallet,
} from '@terra-money/terra.js'
import {
	AddressProviderFromJson,
	Anchor,
	COLLATERAL_DENOMS,
	columbus4,
	MARKET_DENOMS,
	tequila0004,
} from '@anchor-protocol/anchor.js'
import { Logger } from './Logger'

const MICRO_MULTIPLIER = 1_000_000

// TODO: See if we can make it dynamic
type Channels = { main: Msg[]; tgBot: Msg[] }
type ChannelName = keyof Channels

type BotStatus = 'IDLE' | 'RUNNING' | 'PAUSE'

function isBoolean(v) {
	return ['true', true, '1', 1, 'false', false, '0', 0].includes(v)
}

function toBoolean(v) {
	return ['true', true, '1', 1].includes(v)
}

function sleep(seconds) {
	return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}

export class Bot {
	#failureCount = 0
	#walletDenom: any
	#config: Record<string, any>
	#cache: Map<string, Decimal> = new Map()
	#client: LCDClient
	#anchor: Anchor
	#wallet: Wallet
	#txChannels: Channels = { main: [], tgBot: [] }
	#status: BotStatus = 'IDLE'
	#addressProvider: AddressProviderFromJson

	constructor(config: any) {
		this.#config = config

		// Initialization of the Terra Client
		this.#client = new LCDClient({
			URL: this.#config.lcdUrl,
			chainID: this.#config.chainId,
			gasPrices: '0.456uusd',
			gasAdjustment: 1.6,
		})

		// Initialization of the Anchor Client
		const provider = this.#config.chainId === 'columbus-4' ? columbus4 : tequila0004
		this.#addressProvider = new AddressProviderFromJson(provider)
		this.#anchor = new Anchor(this.#client, this.#addressProvider)

		// Initialization of the user Wallet
		const key = new MnemonicKey({ mnemonic: this.#config.mnemonic })
		this.#wallet = new Wallet(this.#client, key)

		this.#walletDenom = {
			address: this.#wallet.key.accAddress,
			market: Denom.USD,
		}

		this.info()
	}

	info() {
		Logger.log(dedent`<b>v0.2.9 - Anchor Borrow / Repay Bot</b>
				Made by Romain Lanz
				
				<b>Network:</b> <code>${this.#config.chainId === 'columbus-4' ? 'Mainnet' : 'Testnet'}</code>
				<b>Address:</b>
				<a href="https://finder.terra.money/${this.#config.chainId}/address/${this.#wallet.key.accAddress}">
					${this.#wallet.key.accAddress}
				</a>

				<b>Status:</b> <code>${this.#status}</code>
				
				<u>Configuration:</u>
					- <b>SAFE:</b> <code>${this.#config.ltv.safe}%</code>
					- <b>LIMIT:</b> <code>${this.#config.ltv.limit}%</code>
					- <b>BORROW:</b> <code>${this.#config.ltv.borrow}%</code>
				
				<u>Compound minimums:</u>
					- <b>ANC:</b> <code>${this.#config.compoundMins.anc}</code>
					- <b>LUNA:</b> <code>${this.#config.compoundMins.luna}</code>
					- <b>BLUNA:</b> <code>${this.#config.compoundMins.bluna}</code>
		`)
	}

	set(path: string, value: any) {
		if (path === 'ltv.limit') {
			if (+value > 59) {
				Logger.log('You cannot go over <code>59</code>.')
				return
			}

			value = +value
		} else if (path === 'ltv.safe') {
			if (+value >= this.#config.ltv.limit) {
				Logger.log(`You cannot go over <code>${this.#config.ltv.limit}</code>.`)
				return
			}

			value = +value
		} else if (path === 'ltv.borrow') {
			if (+value >= this.#config.ltv.safe) {
				Logger.log(`You cannot go over <code>${this.#config.ltv.safe}</code>.`)
				return
			}

			value = +value
		} else if (path === 'options.shouldBorrowMore') {
			if (!isBoolean(value)) {
				Logger.log(`The value must be a boolean (true/false).`)
				return
			}

			value = toBoolean(value)
		} else if (path === 'compoundMins.anc') {
			value = +value
		} else if (path === 'compoundMins.luna') {
			value = +value
		} else if (path === 'compoundMins.bluna') {
			value = +value
		} else {
			Logger.log(`Invalid set option, <code>${path}</code> is not a recognized option`)
			return
		}

		dset(this.#config, path, value)
		Logger.log(`Configuration changed. <code>${path}</code> is now at <code>${value}</code>`)
	}

	run() {
		if (this.#status !== 'PAUSE') {
			Logger.log('Bot should be paused to run this command')
			return
		}

		this.#status = 'IDLE'
		Logger.log('Bot started')
	}

	pause() {
		this.#status = 'PAUSE'
		this.#failureCount = 0
		this.clearCache()
		this.clearQueue('main')
		this.clearQueue('tgBot')
		Logger.log('Bot paused')
	}

	// async repay() {
	// 	if (this.#pause) {
	// 		Logger.log('Bot is paused, use <code>/run</code> to start it.')
	// 		return
	// 	}

	// 	if (this.#running) {
	// 		Logger.log('Already running, please retry later.')
	// 		return
	// 	}

	// 	this.#running = true
	// 	const ltv = await this.computeLTV()

	// 	Logger.log(`LTV is at <code>${ltv.toFixed(3)}%</code>... repaying...`)

	// 	const amountToRepay = await this.computeAmountToRepay(0)
	// 	const walletBalance = await this.getUSTBalance()

	// 	if (+walletBalance < +amountToRepay) {
	// 		Logger.toBroadcast('Insufficient liquidity in your wallet... withdrawing...', 'tgBot')
	// 		const depositAmount = await this.getDeposit()

	// 		if (+depositAmount.plus(walletBalance) < +amountToRepay) {
	// 			this.toBroadcast(this.computeWithdrawMessage(depositAmount), 'tgBot')
	// 			Logger.toBroadcast(`Withdrawed <code>${depositAmount.toFixed(3)} UST</code>...`, 'tgBot')
	// 		} else {
	// 			this.toBroadcast(this.computeWithdrawMessage(amountToRepay.minus(walletBalance).plus(10)), 'tgBot')
	// 			Logger.toBroadcast(
	// 				`Withdrawed <code>${amountToRepay.minus(walletBalance).plus(10).toFixed(3)} UST</code>...`,
	// 				'tgBot'
	// 			)
	// 		}
	// 	}

	// 	if (this.#txChannels['tgBot'].length > 0) {
	// 		await this.broadcast('tgBot')
	// 	}

	// 	const walletBalance2 = await this.getUSTBalance()

	// 	if (+walletBalance2 < +amountToRepay) {
	// 		this.toBroadcast(this.computeRepayMessage(walletBalance2), 'tgBot')
	// 		Logger.toBroadcast(`Repaid <code>${walletBalance2.toFixed(3)} UST</code>`, 'tgBot')
	// 	} else {
	// 		this.toBroadcast(this.computeRepayMessage(amountToRepay), 'tgBot')
	// 		Logger.toBroadcast(`Repaid <code>${amountToRepay.toFixed(3)} UST</code>`, 'tgBot')
	// 	}

	// 	await sleep(10)
	// 	await this.broadcast('tgBot')
	// 	Logger.broadcast('tgBot')
	// 	this.stopExecution()
	// 	this.clearCache()
	// 	this.clearQueue('tgBot')
	// }

	async execute(goTo?: number, channelName: ChannelName = 'main') {
		if (this.#status === 'PAUSE') {
			if (channelName === 'tgBot') {
				Logger.log('Bot is paused, use <code>/run</code> to start it.')
			}

			return
		}

		if (this.#status === 'RUNNING') {
			if (channelName === 'tgBot') {
				Logger.log('Already running, please retry later.')
			}

			if (this.#failureCount >= 5) {
				Logger.log('It seems that the bot is stuck! Restarting...')
				this.pause()
				setTimeout(() => this.run(), 1000)
			}

			this.#failureCount++
			return
		}

		if (typeof goTo !== 'undefined') {
			if (goTo >= this.#config.ltv.limit) {
				Logger.log(`You cannot try to go over ${this.#config.ltv.limit}%`)
				return
			}

			if (this.#config.options.shouldBorrowMore && goTo <= this.#config.ltv.borrow) {
				Logger.log(`You cannot try to go under ${this.#config.ltv.borrow}%`)
				return
			}
		}

		this.#status = 'RUNNING'
		const ltv = await this.computeLTV()

		if (this.#config.options.shouldBorrowMore && +ltv.toFixed(3) < (goTo ?? this.#config.ltv.borrow)) {
			Logger.log(`LTV is at <code>${ltv.toFixed(3)}%</code>... borrowing...`)

			const amountToBorrow = await this.computeAmountToBorrow(goTo)
			this.toBroadcast(this.computeBorrowMessage(amountToBorrow), channelName)
			this.toBroadcast(this.computeDepositMessage(amountToBorrow), channelName)
			await this.broadcast(channelName)

			Logger.log(
				`Borrowed & Deposited <code>${amountToBorrow.toFixed(3)} UST</code>... LTV is now at <code>${
					goTo || this.#config.ltv.safe
				}%</code>`
			)
		}

		if (+ltv.toFixed(3) > (goTo ?? this.#config.ltv.limit)) {
			Logger.log(`LTV is at <code>${ltv.toFixed(3)}%</code>... repaying...`)

			const amountToRepay = await this.computeAmountToRepay(goTo)
			const walletBalance = await this.getUSTBalance()

			if (+walletBalance.minus(10) < +amountToRepay) {
				Logger.toBroadcast('Insufficient liquidity in your wallet... withdrawing...', channelName)

				const amountToWithdraw = amountToRepay.minus(walletBalance).plus(7)
				const depositAmount = await this.getDeposit()

				if (+depositAmount > +amountToWithdraw) {
					this.toBroadcast(this.computeWithdrawMessage(amountToWithdraw), channelName)
					Logger.toBroadcast(`Withdrawed <code>${amountToWithdraw.toFixed(3)} UST</code>...`, channelName)
				} else {
					Logger.toBroadcast('Insufficient deposit... trying to claim...', channelName)
					await this.executeClaimRewards()

					const ancBalance = await this.getANCBalance()
					const ancPrice = await this.getANCPrice()

					if (+ancPrice.times(ancBalance) > +amountToRepay) {
						const quantityToSell = amountToRepay.dividedBy(ancPrice)
						this.toBroadcast(this.computeSellANCMessage(quantityToSell), channelName)
						Logger.toBroadcast(
							`Sold <code>${quantityToSell.toFixed(3)} ANC</code> at <code>${ancPrice.toFixed(
								3
							)} UST</code> per ANC...`,
							channelName
						)

						const toStake = ancBalance.minus(quantityToSell)
						this.toBroadcast(this.computeStakeANCMessage(toStake), channelName)
						Logger.toBroadcast(`Staked <code>${toStake.toFixed(3)} ANC</code>...`, channelName)
					} else {
						Logger.toBroadcast(`Impossible to repay <code>${amountToRepay.toFixed(3)} UST</code>`, channelName)
						Logger.broadcast(channelName)
						this.#txChannels['main'] = []
						this.#status = 'IDLE'
						this.#failureCount = 0
						return
					}
				}
			}

			this.toBroadcast(this.computeRepayMessage(amountToRepay), channelName)
			await this.broadcast(channelName)

			Logger.toBroadcast(
				`Repaid <code>${amountToRepay.toFixed(3)} UST</code>... LTV is now at <code>${
					goTo || this.#config.ltv.safe
				}%</code>`,
				channelName
			)
			Logger.broadcast(channelName)
		}

		this.#failureCount = 0
		this.#status = 'IDLE'
	}

	async compound(type: 'borrow' | 'earn') {
		if (this.#status === 'PAUSE') {
			Logger.log('Bot is paused, use <code>/run</code> to start it.')
			return
		}

		if (this.#status === 'RUNNING') {
			Logger.log('Already running, please retry later.')

			if (this.#failureCount >= 5) {
				Logger.log('It seems that the bot is stuck! Restarting...')
				this.pause()
				setTimeout(() => this.run(), 1000)
			}

			this.#failureCount++
			return
		}

		this.#status = 'RUNNING'

		Logger.log('Starting to compound...')

		if (!process.env.VALIDATOR_ADDRESS) {
			Logger.log('Invalid Validator Address')
			this.#status = 'IDLE'
			return
		}

		await this.executeClaimRewards()
		await sleep(6)

		const ancBalance = await this.getANCBalance()
		const ancPrice = await this.getANCPrice()

		try {
			Logger.toBroadcast(`ANC balance: <code>${ancBalance.toFixed()}</code>`, 'tgBot')

			if (+ancBalance > this.#config.compoundMins.anc) {
				await this.#anchor.anchorToken.sellANC(ancBalance.toFixed()).execute(this.#wallet, { gasPrices: '0.15uusd' })
				await sleep(6)

				if (type === 'earn') {
					const amount = ancBalance.times(ancPrice)
					const msgs = this.computeDepositMessage(amount)
					const tx = await this.#wallet.createAndSignTx({ msgs, feeDenoms: [Denom.USD] })
					await this.#client.tx.broadcast(tx)

					Logger.toBroadcast(`Deposited ${amount.toFixed()} UST`, 'tgBot')
					Logger.broadcast('tgBot')
					this.#status = 'IDLE'
					return
				}

				const msg = new MsgSwap(
					this.#wallet.key.accAddress,
					new Coin(Denom.USD, ancBalance.times(ancPrice).times(MICRO_MULTIPLIER).toFixed(0, Decimal.ROUND_DOWN)),
					Denom.LUNA
				)

				const tx = await this.#wallet.createAndSignTx({ msgs: [msg], fee: new StdFee(600_000, { uusd: 90_000 }) })
				await this.#client.tx.broadcast(tx)
				await sleep(6)
				Logger.toBroadcast(`→ Swapped ANC for Luna`, 'tgBot')
			} else {
				Logger.toBroadcast(`→ less than <code>${this.#config.compoundMins.anc}</code>... Skipping ANC swap`, 'tgBot')
			}

			const lunaBalance = await this.getLunaBalance()
			Logger.toBroadcast(`Luna Balance: <code>${lunaBalance.toFixed()}</code>`, 'tgBot')

			if (+lunaBalance > this.#config.compoundMins.luna) {
				const msg = new MsgExecuteContract(
					this.#wallet.key.accAddress,
					this.#addressProvider.bLunaHub(),
					{
						bond: { validator: process.env.VALIDATOR_ADDRESS },
					},
					{ uluna: lunaBalance.times(MICRO_MULTIPLIER).toFixed() }
				)

				const tx = await this.#wallet.createAndSignTx({ msgs: [msg], feeDenoms: [Denom.USD] })
				await this.#client.tx.broadcast(tx)
				await sleep(6)

				Logger.toBroadcast(`→ Swapped Luna for bLuna`, 'tgBot')
			} else {
				Logger.toBroadcast(`→ less than <code>${this.#config.compoundMins.luna}</code>... Skipping Luna swap`, 'tgBot')
			}

			const { balance } = await this.#client.wasm.contractQuery<any>(this.#addressProvider.bLunaToken(), {
				balance: { address: this.#wallet.key.accAddress },
			})

			const bLunaBalance = new Decimal(balance).dividedBy(MICRO_MULTIPLIER)
			Logger.toBroadcast(`bLuna Balance: <code>${bLunaBalance.toFixed()}</code>`, 'tgBot')

			if (+bLunaBalance > this.#config.compoundMins.bluna) {
				await this.#anchor.borrow
					.provideCollateral({
						amount: bLunaBalance.toFixed(),
						collateral: COLLATERAL_DENOMS.UBLUNA,
						market: MARKET_DENOMS.UUSD,
					})
					.execute(this.#wallet, { gasPrices: '0.15uusd' })

				Logger.toBroadcast(`→ Compounded <code>${bLunaBalance.toFixed()} bLuna</code>`, 'tgBot')
			} else {
				Logger.toBroadcast(
					`→ less than <code>${this.#config.compoundMins.bluna}</code>... Skipping bLuna providing`,
					'tgBot'
				)
			}
		} catch (e) {
			console.log(e.response.data)
		}

		Logger.broadcast('tgBot')
		this.#status = 'IDLE'
	}

	stopExecution() {
		this.#status = 'IDLE'
	}

	clearCache() {
		this.#cache.clear()
	}

	async getUSTBalance(): Promise<Decimal> {
		const coins = await this.#client.bank.balance(this.#wallet.key.accAddress)
		const ustCoin = coins.get(Denom.USD)

		if (!ustCoin) {
			return new Decimal(0)
		}

		return ustCoin.amount.dividedBy(MICRO_MULTIPLIER)
	}

	async getLunaBalance(): Promise<Decimal> {
		const coins = await this.#client.bank.balance(this.#wallet.key.accAddress)
		const lunaCoin = coins.get(Denom.LUNA)

		if (!lunaCoin) {
			return new Decimal(0)
		}

		return lunaCoin.amount.dividedBy(MICRO_MULTIPLIER)
	}

	async computeLTV() {
		const borrowedValue = await this.getBorrowedValue()
		const borrowLimit = await this.getBorrowLimit()

		return borrowedValue.dividedBy(borrowLimit.times(10).dividedBy(6)).times(100)
	}

	async computeAmountToRepay(target = this.#config.ltv.safe) {
		const borrowedValue = await this.getBorrowedValue()
		const borrowLimit = await this.getBorrowLimit()
		const amountForSafeZone = new Decimal(target).times(borrowLimit.times(10).dividedBy(6)).dividedBy(100)

		return borrowedValue.minus(amountForSafeZone)
	}

	async computeAmountToBorrow(target = this.#config.ltv.safe) {
		const borrowedValue = await this.getBorrowedValue()
		const borrowLimit = await this.getBorrowLimit()

		return new Decimal(target).times(borrowLimit.times(10).dividedBy(6)).dividedBy(100).minus(borrowedValue)
	}

	async getDeposit(): Promise<Decimal> {
		return new Decimal(await this.#anchor.earn.getTotalDeposit(this.#walletDenom))
		// return this.cache('deposit', () => this.#anchor.earn.getTotalDeposit(this.#walletDenom))
	}

	async getBorrowedValue(): Promise<Decimal> {
		return new Decimal(await this.#anchor.borrow.getBorrowedValue(this.#walletDenom))
		// return this.cache('borrowedValue', () => this.#anchor.borrow.getBorrowedValue(this.#walletDenom))
	}

	async getBorrowLimit(): Promise<Decimal> {
		return new Decimal(await this.#anchor.borrow.getBorrowLimit(this.#walletDenom))
		// return this.cache('borrowLimit', () => this.#anchor.borrow.getBorrowLimit(this.#walletDenom))
	}

	async getANCBalance(): Promise<Decimal> {
		return new Decimal(await this.#anchor.anchorToken.getBalance(this.#wallet.key.accAddress))
		// return this.cache('ancBalance', () => this.#anchor.anchorToken.getBalance(this.#wallet.key.accAddress))
	}

	async getANCPrice(): Promise<Decimal> {
		return new Decimal(await this.#anchor.anchorToken.getANCPrice())
		// return this.cache('ancPrice', () => this.#anchor.anchorToken.getANCPrice())
	}

	computeBorrowMessage(amount: Decimal) {
		return this.#anchor.borrow
			.borrow({ amount: amount.toFixed(3), market: MARKET_DENOMS.UUSD })
			.generateWithWallet(this.#wallet)
	}

	computeDepositMessage(amount: Decimal) {
		return this.#anchor.earn
			.depositStable({ amount: amount.toFixed(3), market: MARKET_DENOMS.UUSD })
			.generateWithWallet(this.#wallet)
	}

	computeWithdrawMessage(amount: Decimal) {
		return this.#anchor.earn
			.withdrawStable({ amount: amount.toFixed(3), market: MARKET_DENOMS.UUSD })
			.generateWithWallet(this.#wallet)
	}

	computeRepayMessage(amount: Decimal) {
		return this.#anchor.borrow
			.repay({ amount: amount.toFixed(3), market: MARKET_DENOMS.UUSD })
			.generateWithWallet(this.#wallet)
	}

	computeSellANCMessage(amount: Decimal) {
		return this.#anchor.anchorToken.sellANC(amount.toFixed(3)).generateWithWallet(this.#wallet)
	}

	computeStakeANCMessage(amount: Decimal) {
		return this.#anchor.anchorToken.stakeVotingTokens({ amount: amount.toFixed(3) }).generateWithWallet(this.#wallet)
	}

	executeClaimRewards() {
		return this.#anchor.anchorToken
			.claimUSTBorrowRewards({ market: MARKET_DENOMS.UUSD })
			.execute(this.#wallet, { fee: new StdFee(600_000, { uusd: 90_000 }) })
	}

	private toBroadcast(message: Msg | Msg[], channelName: ChannelName) {
		if (Array.isArray(message)) {
			this.#txChannels[channelName].push(...message)
			return
		}

		this.#txChannels[channelName].push(message)
	}

	clearQueue(channelName: ChannelName) {
		this.#txChannels[channelName] = []
	}

	private async broadcast(channelName: ChannelName) {
		try {
			const tx = await this.#wallet.createAndSignTx({ msgs: this.#txChannels[channelName], feeDenoms: [Denom.USD] })
			await this.#client.tx.broadcast(tx)
		} catch (e) {
			Logger.log(`An error occured\n${JSON.stringify(e.response.data)}`)
		} finally {
			this.#txChannels[channelName] = []
		}
	}

	private async cache(key: string, callback: () => Promise<string>) {
		if (this.#cache.has(key)) {
			return this.#cache.get(key) as Decimal
		}

		const value = new Decimal(await callback())
		this.#cache.set(key, value)

		return value
	}
}
