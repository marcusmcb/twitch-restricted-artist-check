const dotenv = require('dotenv')
dotenv.config()

const clientId = process.env.SPOTIFY_CLIENT_ID
const redirectUri =
	process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:5000/callback' // Update with your redirect URI
const scopes =
	'playlist-modify-private playlist-modify-public user-read-private'

const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}&scope=${encodeURIComponent(
	scopes
)}&redirect_uri=${encodeURIComponent(redirectUri)}`

console.log('Authorize your app by visiting this URL:', authUrl)
