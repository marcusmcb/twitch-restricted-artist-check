const bodyParser = require('body-parser')
const cors = require('cors')
const express = require('express')
const dotenv = require('dotenv')
const axios = require('axios')

dotenv.config()

const clientId = process.env.SPOTIFY_CLIENT_ID
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN
const playlistId = process.env.SPOTIFY_PLAYLIST_ID
const userId = process.env.SPOTIFY_USER_ID

let authToken

const app = express()
app.use(cors())
app.use(bodyParser.json())
const PORT = process.env.PORT || 5000

// const getArtistStatus = async () => {
// 	const url = 'https://gql.twitch.tv/gql'
//   // const params = new URLSearchParams()
//   // params.append('client_id', process.env.CLIENT_ID)
//   // params.append('client_secret', process.env.CLIENT_SECRET)
//   // params.append('authorization:', authToken)

// 	const headers = {
// 		'Content-Type': 'text/plain;charset=UTF-8',
// 		'Authorization': authToken, // Replace with your OAuth token
// 		'Client-ID': process.env.TWITCH_CLIENT_ID, // Replace with your Client ID
// 		'User-Agent':
// 			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
// 		Accept: '*/*',
// 		'Accept-Encoding': 'gzip, deflate, br, zstd',
// 		'Accept-Language': 'en-US',
// 		Origin: 'https://dashboard.twitch.tv',
// 		Referer: 'https://dashboard.twitch.tv/',
// 		'Sec-Fetch-Site': 'same-site',
// 		'Sec-Fetch-Mode': 'cors',
// 		'Sec-Fetch-Dest': 'empty',
// 		'Sec-Ch-Ua':
// 			'"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
// 		'Sec-Ch-Ua-Mobile': '?0',
// 		'Sec-Ch-Ua-Platform': '"Windows"',
// 	}

// 	const body = JSON.stringify([
// 		{
// 			operationName: 'DJMusicCatalogSearchQuery',
// 			variables: {
// 				searchInput: {
// 					searchType: 'ARTIST',
// 					sortBy: 'BEST_MATCH',
// 					term: 'Madonna',
// 					channelID: process.env.TWITCH_CHANNEL_ID,
// 				},
// 			},
// 			extensions: {
// 				persistedQuery: {
// 					version: 1,
// 					sha256Hash:
// 						'bf84de47edcd146c548e6fc10664441cf32940bab09af63a23f31bedc32bda2c',
// 				},
// 			},
// 		},
// 	])

// 	try {
//     console.log('HEADERS: ', headers)
//     console.log('BODY: ', body)
// 		const response = await axios.post(url, body, {
// 			headers: headers,
// 		})

// 		console.log(JSON.stringify(response.data, null, 2))
// 	} catch (error) {
//     console.log(process.env.TWITCH_CLIENT_ID)
// 		console.error('Error:', error.response.data)
// 	}
// }

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

const generateSafePlaylist = async (playlistId) => {
	console.log('Generating safe playlist...')
	console.log('Playlist ID: ', playlistId)
	try {
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
		const newPlaylistId = await createNewPlaylist(
			accessToken,
			userId,
			'Twitch Safe Playlist'
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
		console.error('Error generating safe playlist:', error)
	}
}

app.get('/', async (req, res) => {
	res.send('Hello World!')
})

app.post('/submitplaylist', async (req, res) => {
	console.log(req.body)
	await generateSafePlaylist(playlistId)
	res.send('Playlist submitted')
})

app.listen(PORT, () => {
	console.log(`twitch-restricted-artist-check is running on port ${PORT}`)
})
