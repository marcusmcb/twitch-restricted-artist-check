const axios = require('axios')
const dotenv = require('dotenv')

dotenv.config()

const clientId = process.env.SPOTIFY_CLIENT_ID
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
const playlistId = process.env.SPOTIFY_PLAYLIST_ID

const getAccessToken = async () => {
	const response = await axios.post(
		'https://accounts.spotify.com/api/token',
		'grant_type=client_credentials',
		{
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Authorization:
					'Basic ' +
					Buffer.from(clientId + ':' + clientSecret).toString('base64'),
			},
		}
	)
	return response.data.access_token
}

const getAllPlaylistTracks = async (accessToken, playlistId) => {
	let tracks = []
	let next = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`

	while (next) {
		const response = await axios.get(next, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		})
		tracks = tracks.concat(response.data.items)
		next = response.data.next
	}
	return tracks
}

const getSpotifyUserName = async (accessToken, userId) => {
	try {
		const response = await axios.get(
			`https://api.spotify.com/v1/users/${userId}`,
			{
				headers: { Authorization: `Bearer ${accessToken}` },
			}
		)
		return response.data.display_name
	} catch (error) {
		console.error('Error fetching user:', error)
	}
}

;(async () => {
	try {
		console.log('Fetching Spotify playlist tracks...')
		const accessToken = await getAccessToken()
		const tracks = await getAllPlaylistTracks(accessToken, playlistId)

		let fullTrackArray = []

		tracks.forEach(async (track) => {
			setTimeout(async () => {
				const addedBy = await getSpotifyUserName(accessToken, track.added_by.id)
				const trackEntry = {
					title: track.track.name,
					artist: track.track.artists.map((artist) => artist.name).join(', '),
					added: addedBy !== undefined ? addedBy : 'user name unavailable',
				}
				console.log('Track: ', trackEntry)
				fullTrackArray.push(trackEntry)
			}, 1500)
		})

		setTimeout(() => {
			console.log('Full Track Array:')
			console.log(fullTrackArray)
		}, 8000)
    
	} catch (error) {
		console.error('Error fetching playlist tracks:', error)
	}
})()
