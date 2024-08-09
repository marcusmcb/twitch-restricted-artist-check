const axios = require('axios')
const dotenv = require('dotenv')
dotenv.config()

const clientId = process.env.SPOTIFY_CLIENT_ID
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
const redirectUri =
	process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:5000/callback'

const code = process.env.SPOTIFY_AUTH_CODE // Paste the authorization code here

const getTokens = async () => {
	try {
		const response = await axios.post(
			'https://accounts.spotify.com/api/token',
			null,
			{
				params: {
					grant_type: 'authorization_code',
					code,
					redirect_uri: redirectUri,
					client_id: clientId,
					client_secret: clientSecret,
				},
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
			}
		)

		const accessToken = response.data.access_token
		const refreshToken = response.data.refresh_token

		console.log('Access Token:', accessToken)
		console.log('Refresh Token:', refreshToken)

		// Save these tokens securely (e.g., in a database or environment variable)
	} catch (error) {
		console.error('Error exchanging code for tokens:', error.response.data)
	}
}

getTokens()
