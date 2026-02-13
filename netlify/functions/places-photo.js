const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

// Base64 encoded 1x1 transparent PNG placeholder
const PLACEHOLDER_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

exports.handler = async (event, context) => {
  const { photoReference } = event.queryStringParameters;

  try {
    const url = `https://maps.googleapis.com/maps/api/place/photo?` +
      `maxwidth=400&` +
      `photoreference=${photoReference}&` +
      `key=${GOOGLE_PLACES_API_KEY}`;

    const response = await fetch(url);

    if (response.status === 302) {
      // Google returned a redirect to the actual image
      const imageUrl = response.headers.get('location');
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: imageUrl,
      };
    }

    // For invalid photos or errors, return placeholder data URL
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: `data:image/png;base64,${PLACEHOLDER_IMAGE}`,
    };
  } catch (error) {
    // Return placeholder on error
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: `data:image/png;base64,${PLACEHOLDER_IMAGE}`,
    };
  }
};