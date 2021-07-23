import got from 'got'
import config from '../config'

// TODO: See if we can make it dynamic
type Channels = { main: string[]; tgBot: string[] }
type ChannelName = keyof Channels
export class Logger {
	static channels: Channels = { main: [], tgBot: [] }

	static log(message: string) {
		if (config.notification.tty) {
			console.log(message)
		}

		if (config.notification.telegram) {
			Logger.sendTelegramNotification(message)
		}
	}

	static sendTelegramNotification(message: string) {
		got
			.post(`https://api.telegram.org/bot${config.telegram.apiKey}/sendMessage`, {
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					chat_id: config.telegram.userId,
					text: message,
					parse_mode: 'HTML',
				}),
				retry: 5,
			})
			.catch(() => {})
	}

	static clearChannel(channelName: ChannelName) {
		Logger.channels[channelName] = []
	}

	static toBroadcast(message: string, channelName: ChannelName) {
		Logger.channels[channelName].push(message)
	}

	static broadcast(channelName: ChannelName) {
		const messageToSend = Logger.channels[channelName].join('\n')
		Logger.log(messageToSend)
		Logger.channels[channelName] = []
	}
}
