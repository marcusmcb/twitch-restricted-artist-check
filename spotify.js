const axios = require('axios')
const dotenv = require('dotenv')
const restrictedArtists = require('./artistList')

dotenv.config()

const clientId = process.env.SPOTIFY_CLIENT_ID
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
const playlistId = process.env.SPOTIFY_PLAYLIST_ID
const userId = process.env.SPOTIFY_USER_ID

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

const createNewPlaylist = async (accessToken, userId, playlistName) => {
	try {
		const response = await axios.post(
			`https://api.spotify.com/v1/users/${userId}/playlists`,
			{
				name: playlistName,
				description: 'A playlist free of restricted artists',
				public: false,
			},
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				},
			}
		)
		if (response.data.id) {
			console.log('New playlist created successfully!')
		}
		return response.data.id
	} catch (error) {
		console.error('Error creating new playlist:', error)
	}
}

const addTracksToPlaylist = async (accessToken, playlistId, trackUris) => {
	try {
		await axios.post(
			`https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
			{
				uris: trackUris,
			},
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				},
			}
		)
		console.log('Tracks added to the playlist successfully!')
	} catch (error) {
		console.error('Error adding tracks to the playlist:', error)
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
		let trackUris = []

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
			const trackEntry = {
				title: track.track.name,
				artist: artistNames.join(', '),
				added: addedBy,
				spotify_url: track.track.external_urls.spotify,
			}
			fullTrackArray.push(trackEntry)
			trackUris.push(track.track.uri)

			// Delay before the next request
			await delay(20)
		}

		// Create a new playlist
		const newPlaylistId = await createNewPlaylist(
			accessToken,
			userId,
			'Safe Playlist'
		)

		setTimeout(() => {
			// Add the safe tracks to the new playlist
			if (newPlaylistId) {
				console.log('New Playlist ID: ', newPlaylistId)
			} else {
				console.log('No new playlist ID')
			}
		}, 1000)

		// Add the safe tracks to the new playlist
		// await addTracksToPlaylist(accessToken, newPlaylistId, trackUris)

		// console.log('Playable Tracks: ')
		// console.log(fullTrackArray)
		// console.log('------------------------')
		console.log('Original Playlist Length: ', tracks.length)
		console.log('Restricted Track Array: ', restrictedTracks.length)
		console.log('Clean Track Array: ', fullTrackArray.length)
	} catch (error) {
		console.error('Error fetching playlist tracks:', error)
	}
})()
