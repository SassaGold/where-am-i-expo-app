const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

exports.handler = async (event, context) => {
  const { photoReference } = event.queryStringParameters;

  try {
    const url = `https://maps.googleapis.com/maps/api/place/photo?` +
      `maxwidth=400&` +
      `photoreference=${photoReference}&` +
      `key=${GOOGLE_PLACES_API_KEY}`;

    const response = await fetch(url);

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: 'Photo not found',
      };
    }

    const buffer = await response.arrayBuffer();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': response.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
      body: Buffer.from(buffer).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};