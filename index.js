const bodyParser = require('body-parser')
const cors = require('cors')
const express = require('express')
const dotenv = require('dotenv')
const axios = require('axios')

dotenv.config()

let authToken

const app = express()
app.use(cors())
app.use(bodyParser.json())
const PORT = process.env.PORT || 5000

const getAuthToken = async () => {
	const authURL = 'https://id.twitch.tv/oauth2/token'
	try {
		const response = await axios.post(authURL, {
			client_id: process.env.TWITCH_CLIENT_ID,
			client_secret: process.env.TWITCH_CLIENT_SECRET,
			grant_type: 'client_credentials',
		})
		authToken = response.data.access_token
		console.log(response.data)
		return
	} catch (err) {
		console.error('AUTH ERROR: ', err.data)    
	}
}

const getArtistStatus = async () => {
	const url = 'https://gql.twitch.tv/gql'
  // const params = new URLSearchParams()
  // params.append('client_id', process.env.CLIENT_ID)
  // params.append('client_secret', process.env.CLIENT_SECRET)
  // params.append('authorization:', authToken)

	const headers = {
		'Content-Type': 'text/plain;charset=UTF-8',
		'Authorization': authToken, // Replace with your OAuth token
		'Client-ID': process.env.TWITCH_CLIENT_ID, // Replace with your Client ID
		'User-Agent':
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
		Accept: '*/*',
		'Accept-Encoding': 'gzip, deflate, br, zstd',
		'Accept-Language': 'en-US',
		Origin: 'https://dashboard.twitch.tv',
		Referer: 'https://dashboard.twitch.tv/',
		'Sec-Fetch-Site': 'same-site',
		'Sec-Fetch-Mode': 'cors',
		'Sec-Fetch-Dest': 'empty',
		'Sec-Ch-Ua':
			'"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
		'Sec-Ch-Ua-Mobile': '?0',
		'Sec-Ch-Ua-Platform': '"Windows"',
	}

	const body = JSON.stringify([
		{
			operationName: 'DJMusicCatalogSearchQuery',
			variables: {
				searchInput: {
					searchType: 'ARTIST',
					sortBy: 'BEST_MATCH',
					term: 'Madonna',
					channelID: process.env.TWITCH_CHANNEL_ID, 
				},
			},
			extensions: {
				persistedQuery: {
					version: 1,
					sha256Hash:
						'bf84de47edcd146c548e6fc10664441cf32940bab09af63a23f31bedc32bda2c',
				},
			},
		},
	])

	try {
    console.log('HEADERS: ', headers)
    console.log('BODY: ', body)
		const response = await axios.post(url, body, {
			headers: headers,
		})

		console.log(JSON.stringify(response.data, null, 2))
	} catch (error) {
    console.log(process.env.TWITCH_CLIENT_ID)
		console.error('Error:', error.response.data)    
	}
}

app.get('/', async (req, res) => {
	res.send('Hello World!')
	await getAuthToken()
	console.log('AUTH TOKEN? ', authToken)
	getArtistStatus()
})

app.get('/auth', (req, res) => {
	console.log(req.body)
	res.send('Auth route')
})

app.listen(PORT, () => {
	console.log(`twitch-restricted-artist-check is running on port ${PORT}`)
})
