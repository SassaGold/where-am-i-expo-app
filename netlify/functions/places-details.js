const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

exports.handler = async (event, context) => {
  const { placeId } = event.queryStringParameters;

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?` +
      `place_id=${placeId}&` +
      `fields=name,formatted_address,formatted_phone_number,website,opening_hours,rating,reviews,photos,types&` +
      `key=${GOOGLE_PLACES_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};