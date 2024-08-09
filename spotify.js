const axios = require('axios')
const dotenv = require('dotenv')
const restrictedArtists = require('./artistList')

dotenv.config()

const clientId = process.env.SPOTIFY_CLIENT_ID
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN
const playlistId = process.env.SPOTIFY_PLAYLIST_ID
const userId = process.env.SPOTIFY_USER_ID

const getAccessToken = async () => {
	try {
		const response = await axios.post(
			'https://accounts.spotify.com/api/token',
			null,
			{
				params: {
					grant_type: 'refresh_token',
					refresh_token: refreshToken,
					client_id: clientId,
					client_secret: clientSecret,
				},
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
			}
		)

		return response.data.access_token
	} catch (error) {
		console.error('Error refreshing access token:', error.response.data)
	}
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
				public: true,
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
	const batchSize = 50 // Set the batch size to 50 or another appropriate number
	for (let i = 0; i < trackUris.length; i += batchSize) {
		const batch = trackUris.slice(i, i + batchSize)

		// Log the current batch for debugging
		// console.log(`Adding batch ${i / batchSize + 1} with URIs:`, batch)

		try {
			await axios.post(
				`https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
				{
					uris: batch,
				},
				{
					headers: {
						Authorization: `Bearer ${accessToken}`,
						'Content-Type': 'application/json',
					},
				}
			)
			console.log(`Batch ${i / batchSize + 1} added successfully!`)
		} catch (error) {
			console.error(
				`Error adding batch ${i / batchSize + 1}:`,
				error.response?.data || error
			)
			return
		}
		await delay(1000)
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
		let invalidTracks = []

		for (const track of tracks) {
			const artistNames = track.track.artists.map((artist) =>
				artist.name !== null ? artist.name.toLowerCase() : null
			) // normalize artist names to lowercase
			const isRestricted = artistNames.some(
				(artist) =>
					restrictedArtists.map((ra) => ra.toLowerCase()).includes(artist) // Normalize restrictedArtists to lowercase
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
				console.log('-----------------------')
				continue
			}

			// validate URI and log invalid ones
			const uri = track.track.uri
			if (uri.startsWith('spotify:track:')) {
				const addedBy = await getSpotifyUserName(accessToken, track.added_by.id)
				const trackEntry = {
					title: track.track.name,
					artist: artistNames.join(', '),
					added: addedBy,
					spotify_url: track.track.external_urls.spotify,
				}
				fullTrackArray.push(trackEntry)
				trackUris.push(uri)
			} else {
				console.log('Invalid URI:', uri)
				invalidTracks.push({
					title: track.track.name,
					artist: artistNames.join(', '),
					uri: uri,
				})
			}

			// delay before the next request
			await delay(10)
		}

		if (invalidTracks.length > 0) {
			console.log('Found invalid URIs:')
			console.log('-----------------------')
			invalidTracks.forEach((track) => {
				console.log(
					`Track: ${track.title} by ${track.artist}, URI: ${track.uri}`
				)
			})
		}

		// create a new playlist
		const newPlaylistId = await createNewPlaylist(
			accessToken,
			userId,
			'Safe Playlist For Rate'
		)

		// add the safe tracks to the new playlist
		await addTracksToPlaylist(accessToken, newPlaylistId, trackUris)

		console.log('Original Playlist Length: ', tracks.length)
		console.log('Clean Track Array: ', fullTrackArray.length)
		console.log('Restricted Track Array: ', restrictedTracks.length)
		console.log('Invalid Track Array: ', invalidTracks.length)
		console.log('-----------------------')
		console.log('Restricted Tracks: ')
		console.log(restrictedTracks)
		console.log('-----------------------')
		console.log('Invalid Tracks: ')
		console.log(invalidTracks)
		console.log('-----------------------')
	} catch (error) {
		console.error('Error fetching playlist tracks:', error)
	}
})()
