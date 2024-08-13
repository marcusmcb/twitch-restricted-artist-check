import axios from 'axios'
import restrictedArtists from './artistList.js'

const clientId = process.env.SPOTIFY_CLIENT_ID
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN
const userId = process.env.SPOTIFY_USER_ID

export const handler = async (event) => {
	const body = JSON.parse(event.body)
	console.log('EVENT: ', event.body)
	console.log('PLAYLIST URL: ', body.playlistUrl)

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

	const extractPlaylistId = (url) => {
		const regex = /playlist\/([a-zA-Z0-9]+)/
		const match = url.match(regex)
		return match ? match[1] : null
	}

	const getSpotifyPlaylistTitle = async (accessToken, playlistId) => {
		try {
			const response = await axios.get(
				`https://api.spotify.com/v1/playlists/${playlistId}`,
				{
					headers: { Authorization: `Bearer ${accessToken}` },
				}
			)
			return response.data.name
		} catch (error) {
			console.error('Error fetching playlist title:', error)
			return 'playlist title unavailable'
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
				console.log('-----------------------')
				console.log(response.data.external_urls.spotify)
				console.log('-----------------------')
			}
			return {
				playlistId: response.data.id,
				playlistUrl: response.data.external_urls.spotify,
			}
		} catch (error) {
			console.error('Error creating new playlist:', error)
		}
	}

	const addTracksToPlaylist = async (accessToken, playlistId, trackUris) => {
		const batchSize = 50 // set the batch size per Spotify's API requirements
		for (let i = 0; i < trackUris.length; i += batchSize) {
			const batch = trackUris.slice(i, i + batchSize)
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

	const getSafePlaylist = async (playlistUrl) => {
		try {
			const playlistId = extractPlaylistId(playlistUrl)
			console.log('Playlist ID:', playlistId)
			console.log('Fetching Spotify playlist tracks...')
			const accessToken = await getAccessToken()
			const playlistTitle = await getSpotifyPlaylistTitle(
				accessToken,
				playlistId
			)
			setTimeout(() => console.log('Playlist Title: ', playlistTitle), 1000)
			const tracks = await getAllPlaylistTracks(accessToken, playlistId)

			let fullTrackArray = []
			let restrictedTracks = []
			let trackUris = []
			let invalidTracks = []

			for (const track of tracks) {
				const artistNames = track.track.artists.map((artist) =>
					artist.name !== null ? artist.name.toLowerCase() : null
				)
				const isRestricted = artistNames.some((artist) =>
					restrictedArtists.map((ra) => ra.toLowerCase()).includes(artist)
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
					// const addedBy = await getSpotifyUserName(accessToken, track.added_by.id)
					const trackEntry = {
						title: track.track.name,
						artist: artistNames.join(', '),
						// added: addedBy,
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
			const newPlaylistData = await createNewPlaylist(
				accessToken,
				userId,
				'(SAFE) ' + playlistTitle
			)

			// add the safe tracks to the new playlist
			await addTracksToPlaylist(
				accessToken,
				newPlaylistData.playlistId,
				trackUris
			)

			console.log('Original Playlist Length: ', tracks.length)
			console.log('Clean Track Array: ', fullTrackArray.length)
			console.log('Restricted Track Array: ', restrictedTracks.length)
			console.log('Invalid Track Array: ', invalidTracks.length)
			console.log('New Playlist URL:', newPlaylistData.playlistUrl)
			return newPlaylistData.playlistUrl
		} catch (error) {
			console.error('Error fetching playlist tracks:', error)
		}
	}

	const newUrl = await getSafePlaylist(body.playlistUrl)

	const response = {
		statusCode: 200,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*', 
			'Access-Control-Allow-Headers': 'Content-Type',
			'Access-Control-Allow-Methods': 'OPTIONS,POST',
		},
		body: JSON.stringify({
			url: newUrl,
		}),
	}

	return response
}
