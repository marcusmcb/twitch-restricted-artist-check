const axios = require('axios')
const dotenv = require('dotenv')
const restrictedArtists = require('./artistList')

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
		return 'user name unavailable'
	}
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

;(async () => {
	try {
		console.log('Fetching Spotify playlist tracks...')
		const accessToken = await getAccessToken()
		const tracks = await getAllPlaylistTracks(accessToken, playlistId)

		let fullTrackArray = []
		let restrictedTracks = []

		for (const track of tracks) {
			const artistNames = track.track.artists.map((artist) => artist.name)
			const isRestricted = artistNames.some((artist) =>
				restrictedArtists.includes(artist)
			)

			if (isRestricted) {
				const trackEntry = {
					title: track.track.name,
					artist: artistNames.join(', '),
				}
				restrictedTracks.push(trackEntry)
				console.log(
					'Restricted Track:',
					track.track.name,
					'by',
					artistNames.join(', ')
				)
				continue
			}

			const addedBy = await getSpotifyUserName(accessToken, track.added_by.id)
			// add spotify URL for each song to the track object
			const trackEntry = {
				title: track.track.name,
				artist: artistNames.join(', '),
				added: addedBy,
			}
			fullTrackArray.push(trackEntry)

			// Delay before the next request
			await delay(20)
		}

		console.log('Playable Tracks: ')
		console.log(fullTrackArray)
		console.log('------------------------')
		console.log('Sample Spotify Track Object: ')
		console.log(tracks[0])
		console.log('------------------------')
		console.log('Original Playlist Length: ', tracks.length)
		console.log('Restricted Track Array: ', restrictedTracks.length)
		console.log('Clean Track Array: ', fullTrackArray.length)
	} catch (error) {
		console.error('Error fetching playlist tracks:', error)
	}
})()
